# AsterDrive 架构概览

本文描述的是当前仓库已经落地的实现，而不是早期设计草图。

## 当前系统边界

AsterDrive 现在提供四类对外能力：

- HTTP API：`/api/v1/*` 下的认证、文件、文件夹、分享、WebDAV 账号、回收站、属性、管理接口
- 健康检查：`/health*` 路径独立于 API 前缀
- WebDAV：默认挂在 `/webdav`
- 内嵌前端：React 管理界面与公开分享页由后端直接服务

当前代码中没有可直接使用的独立 CLI 子命令入口。`Cargo.toml` 里保留了 `cli` feature，但仓库主执行面仍然是 HTTP/WebDAV 服务。

## 分层结构

```text
┌────────────────────────────────────────────────────────────┐
│ 接口层                                                     │
│  - React 前端（嵌入式 SPA）                                │
│  - REST API（actix-web）                                  │
│  - WebDAV（dav-server）                                   │
├────────────────────────────────────────────────────────────┤
│ 应用层                                                     │
│  - 路由、中间件、统一响应、错误码                           │
│  - JWT / Cookie 认证、CORS、Request ID                     │
├────────────────────────────────────────────────────────────┤
│ 业务服务层                                                 │
│  - auth / file / folder / share / upload / trash          │
│  - version / thumbnail / policy / config / lock           │
│  - webdav_account / webdav_service / property             │
├────────────────────────────────────────────────────────────┤
│ 基础设施层                                                 │
│  - SeaORM + migrations                                    │
│  - StorageDriver(Local/S3)                                │
│  - CacheBackend(Memory/Redis/Noop)                        │
├────────────────────────────────────────────────────────────┤
│ 数据层                                                     │
│  - users / folders / files / file_blobs                   │
│  - shares / upload_sessions / file_versions               │
│  - webdav_accounts / resource_locks / entity_properties   │
│  - system_config / storage_policies / user_storage_policies│
└────────────────────────────────────────────────────────────┘
```

## 关键模块

| 模块                 | 责任                                                |
| -------------------- | --------------------------------------------------- |
| `src/main.rs`        | 启动顺序、HTTP 服务器、后台清理任务、优雅退出       |
| `src/api/`           | 路由注册、Swagger/OpenAPI、统一响应与错误码、中间件 |
| `src/services/`      | 业务逻辑，几乎所有跨模块规则都在这里                |
| `src/storage/`       | 存储抽象层，负责本地与 S3 驱动                      |
| `src/webdav/`        | WebDAV 文件系统、认证、锁系统、路径解析             |
| `src/db/repository/` | 面向实体的数据库访问封装                            |
| `frontend-panel/`    | React 19 + Vite 前端，打包后嵌入二进制              |
| `migration/`         | SeaORM 迁移，启动时自动执行                         |

## 启动流程

1. 安装 panic hook。
2. 加载 `config.toml`；若不存在则在当前工作目录自动生成。
3. 初始化日志。
4. 连接数据库并执行全部迁移。
5. 若系统中还没有任何存储策略，自动创建默认本地策略 `Local Default`，目录为 `data/uploads`。
6. 初始化驱动注册中心与缓存后端。
7. 注册 API、健康检查、WebDAV、前端路由。
8. 启动三个后台清理任务：
   - 过期分片上传 session，每小时一次
   - 过期回收站条目，每小时一次
   - 过期资源锁，每小时一次

## 数据模型与核心概念

### 1. 文件与 Blob 分离

- `files` 代表用户可见文件记录，保存文件名、所属文件夹、当前 `blob_id`
- `file_blobs` 代表物理内容，按 `sha256 + policy_id` 去重
- 多个文件可引用同一 Blob；Blob 的 `ref_count` 控制物理删除时机

这让系统可以同时支持：

- 内容去重
- 版本历史
- 复制文件时的低成本复用

### 2. 存储策略驱动

策略保存在数据库中，而不是 `config.toml`。

实际解析顺序是：

```text
文件夹 policy_id -> 用户默认策略 -> 系统默认策略
```

策略决定：

- 存储驱动类型：`local` 或 `s3`
- 物理目标位置：本地目录或 S3 bucket/prefix
- 文件大小上限
- 分片大小 `chunk_size`

### 3. 软删除与回收站

- 普通删除进入回收站，设置 `deleted_at`
- 文件夹删除会递归标记子文件和子文件夹
- 恢复时如果原父目录已经不存在，会自动恢复到根目录
- 真正物理删除由显式 purge 或后台保留期清理触发

### 4. 版本与锁

- 文件历史版本保存在 `file_versions`
- 当前实现里，版本主要来自覆盖写入流程，例如 WebDAV 覆盖
- WebDAV/REST 共用 `resource_locks` 表
- `files.is_locked` / `folders.is_locked` 是快速状态缓存，不是锁的唯一事实来源

### 5. 分享

- 分享可以指向文件或文件夹
- 支持密码、过期时间、下载次数上限
- 公开分享读取通过 `/api/v1/s/{token}/*`
- 前端公开页面路由是 `/s/:token`

### 6. WebDAV 专用账号

- WebDAV Basic Auth 使用独立账号表 `webdav_accounts`
- 每个账号可限制到某个根文件夹
- 同时也支持 `Authorization: Bearer <jwt>` 访问全部用户空间

## 关键请求路径

### 文件上传

1. 前端或客户端先决定走直传还是协商式分片上传。
2. 服务端根据目标存储策略的 `chunk_size` 与文件大小返回：
   - `direct`
   - `chunked`
3. 最终写入时统一走 `file_service::store_from_temp` 或分片组装流程。
4. 服务端计算 SHA-256，检查配额、大小上限与去重。
5. 新建 `files` 记录，更新用户占用空间。

### 文件覆盖与版本

1. 覆盖写入时先检查锁状态。
2. 当前 Blob 变成历史版本记录。
3. 文件切换到新的 `blob_id`。
4. 超出 `max_versions_per_file` 的最老版本会自动清理。

### 分享访问

1. 客户端先读取分享元信息。
2. 如果分享有密码，调用验证接口。
3. 服务端写入一个 1 小时的 HttpOnly cookie 标记已验证。
4. 之后才能下载文件、访问分享文件夹内容或读取缩略图。

### WebDAV 请求

1. 路由先检查运行时开关 `webdav_enabled`。
2. 然后通过 Basic 或 Bearer 做认证。
3. 为每个请求构造带用户上下文的 `AsterDavFs` 与数据库锁系统。
4. 由 `dav-server` 继续分派 `PROPFIND`、`LOCK`、`MOVE`、`COPY`、`PUT` 等方法。

## 嵌入式前端

- `build.rs` 会在编译阶段检查 `frontend-panel/dist`
- 若前端未构建，构建脚本会生成一个回退页，提示先执行前端构建
- 生产二进制仍然可以启动 API，只是首页不会是完整管理界面

## 可观测性与调试

- `/health` 与 `/health/ready` 默认可用
- `/health/metrics` 只有启用 `metrics` feature 时才注册
- `/swagger-ui` 与 `/api-docs/openapi.json` 只在 debug 构建中注册
- 前端消费的 OpenAPI 静态文件通过 `cargo test --test generate_openapi` 生成到 `frontend-panel/generated/openapi.json`
  | **File** | 虚拟文件记录，多个 File 可指向同一 FileBlob |
  | **Folder** | 树形文件夹（parent_id 自引用），可覆盖 policy_id |
  | **UserStoragePolicy** | 用户-策略关联，支持多策略 + 默认策略 + 配额 |

### 4.3 存储策略优先级链

```text
文件夹级 policy_id  →  用户级默认策略(缓存)  →  系统全局默认策略
```

`resolve_policy()` 按此链解析，结果缓存到 `policy:{id}` 和 `user_default_policy:{user_id}`。

---

## 5. 关键模块设计

### 5.1 StorageDriver Trait

```rust
#[async_trait]
pub trait StorageDriver: Send + Sync {
    async fn put(&self, path: &str, data: &[u8]) -> Result<String>;
    async fn get(&self, path: &str) -> Result<Vec<u8>>;
    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>>;
    async fn delete(&self, path: &str) -> Result<()>;
    async fn exists(&self, path: &str) -> Result<bool>;
    async fn metadata(&self, path: &str) -> Result<BlobMetadata>;
    async fn put_file(&self, storage_path: &str, local_path: &str) -> Result<String>;
    async fn presigned_url(&self, path: &str, expires: Duration) -> Result<Option<String>>;
}
```

Blob 存储路径：`{hash[0:2]}/{hash[2:4]}/{hash}`

### 5.2 错误系统（两层）

**内部层** — `AsterError` 枚举，字符串码 E001-E058，用于日志：

- E001-E009: 基础设施 / E010-E019: 认证 / E020-E029: 文件
- E030-E039: 存储策略 / E040-E049: 文件夹 / E050-E053: 分享
- E054-E057: 分片上传 / E058: 缩略图

**API 层** — `ErrorCode` 数字码，千位分域：

- 0: 成功 / 1000: 通用 / 2000: 认证 / 3000: 文件
- 4000: 存储策略 / 5000: 文件夹 / 6000: 分享

### 5.3 Service 层统一签名

所有 service 函数第一参数为 `state: &AppState`，内部通过 `state.db`/`state.driver_registry`/`state.config`/`state.cache` 访问基础设施。新增基础设施时只需改 AppState，不用改函数签名。

### 5.4 缓存集成

- `CacheBackend` trait (bytes 接口, dyn compatible) + `CacheExt` trait (泛型 get/set)
- 三种实现：`NoopCache` / `MemoryCache(moka)` / `RedisCache`
- 缓存键约定：`policy:{id}`, `user_default_policy:{user_id}`
- Policy 写操作自动 invalidate 对应缓存

### 5.5 缩略图

- 懒生成：首次请求 `GET /files/{id}/thumbnail` 时生成
- 格式：WebP, max 200×200, per-blob（去重文件共享缩略图）
- 存储路径：`_thumb/{hash[0:2]}/{hash[2:4]}/{hash}.webp`（同存储驱动）
- HTTP 缓存：`Cache-Control: public, max-age=31536000, immutable`
- 文件删除时 best-effort 清理缩略图

### 5.6 WebDAV

基于 `dav-server` crate (v0.11, RFC4918 完整实现)，Class 1 + LOCK。

**架构**：

```text
WebDAV Client → /webdav/{path}
    → actix handler
    → authenticate (Basic Auth / Bearer JWT)
    → AsterDavFs { state, user_id } (per-request)
    → DavHandler::handle_with(config, req)
    → dav-server 处理 XML/协议
    → DavFileSystem 方法 → path_resolver → repos/services → StorageDriver
```

**关键设计**：

- 路径解析：逐段 walk 数据库 folder 树，最后一段先查 folder 再查 file
- 锁系统：`MemLs` 单例（进程内共享，重启丢失）
- COPY 利用 blob 去重：只增 ref_count，不复制物理数据
- 递归操作：`webdav_service::recursive_delete_folder` / `recursive_copy_folder`（Box::pin 异步递归）

**运行时配置**（system_config 表）：

- `webdav_enabled`: 动态开关（默认 true）
- `webdav_max_upload_size`: 软上传限制（默认 1GB）

**静态配置**（config.toml `[webdav]`）：

- `prefix`: 路由前缀（默认 `/webdav`，改了要重启）
- `payload_limit`: actix 硬上限（默认 10GB）

### 5.7 配置系统

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0                # 0 = num_cpus

[database]
url = "sqlite://asterdrive.db?mode=rwc"
pool_size = 10

[auth]
jwt_secret = "<auto-generated>"
access_token_ttl_secs = 900     # 15 min
refresh_token_ttl_secs = 604800 # 7 days

[cache]
enabled = true
backend = "memory"   # "memory" | "redis"
default_ttl = 3600

[logging]
level = "info"
format = "text"      # "text" | "json"

[webdav]
prefix = "/webdav"
payload_limit = 10737418240  # 10 GB
```

加载优先级：环境变量 (`ASTER__`) > `config.toml` > 默认值

运行时配置存 `system_config` 表，通过 Admin API (`/api/v1/admin/config`) 管理。

---

## 6. API 设计

### 6.1 路由总览

| 方法       | 路径                                 | 说明                      | 认证          |
| ---------- | ------------------------------------ | ------------------------- | ------------- |
| **认证**   |                                      |                           |               |
| POST       | `/api/v1/auth/register`              | 注册                      | -             |
| POST       | `/api/v1/auth/login`                 | 登录 (Cookie)             | -             |
| POST       | `/api/v1/auth/refresh`               | 刷新 token                | Cookie        |
| POST       | `/api/v1/auth/logout`                | 登出                      | -             |
| GET        | `/api/v1/auth/me`                    | 当前用户信息              | Cookie/Bearer |
| **文件**   |                                      |                           |               |
| POST       | `/api/v1/files/upload`               | 直传上传                  | JWT           |
| POST       | `/api/v1/files/upload/init`          | 上传协商 (direct/chunked) | JWT           |
| PUT        | `/api/v1/files/upload/{id}/{chunk}`  | 分片上传                  | JWT           |
| POST       | `/api/v1/files/upload/{id}/complete` | 完成分片                  | JWT           |
| GET        | `/api/v1/files/upload/{id}`          | 上传进度                  | JWT           |
| DELETE     | `/api/v1/files/upload/{id}`          | 取消上传                  | JWT           |
| GET        | `/api/v1/files/{id}`                 | 文件信息                  | JWT           |
| GET        | `/api/v1/files/{id}/download`        | 下载                      | JWT           |
| GET        | `/api/v1/files/{id}/thumbnail`       | 缩略图 (WebP)             | JWT           |
| DELETE     | `/api/v1/files/{id}`                 | 删除                      | JWT           |
| PATCH      | `/api/v1/files/{id}`                 | 重命名/移动               | JWT           |
| **文件夹** |                                      |                           |               |
| GET        | `/api/v1/folders`                    | 根目录内容                | JWT           |
| POST       | `/api/v1/folders`                    | 创建                      | JWT           |
| GET        | `/api/v1/folders/{id}`               | 列出内容                  | JWT           |
| DELETE     | `/api/v1/folders/{id}`               | 删除                      | JWT           |
| PATCH      | `/api/v1/folders/{id}`               | 重命名/移动/设策略        | JWT           |
| **分享**   |                                      |                           |               |
| POST       | `/api/v1/shares`                     | 创建分享                  | JWT           |
| GET        | `/api/v1/shares`                     | 我的分享列表              | JWT           |
| DELETE     | `/api/v1/shares/{id}`                | 删除分享                  | JWT           |
| GET        | `/api/v1/s/{token}`                  | 查看分享信息              | -             |
| POST       | `/api/v1/s/{token}/verify`           | 验证密码                  | -             |
| GET        | `/api/v1/s/{token}/download`         | 下载分享文件              | Cookie        |
| GET        | `/api/v1/s/{token}/content`          | 分享文件夹内容            | Cookie        |
| **管理**   |                                      |                           |               |
| \*         | `/api/v1/admin/policies/*`           | 存储策略 CRUD             | Admin         |
| \*         | `/api/v1/admin/users/*`              | 用户管理 + 策略分配       | Admin         |
| \*         | `/api/v1/admin/shares/*`             | 分享管理                  | Admin         |
| \*         | `/api/v1/admin/config/*`             | 系统配置 CRUD             | Admin         |
| **WebDAV** |                                      |                           |               |
| \*         | `/webdav/*`                          | RFC4918 WebDAV            | Basic/Bearer  |
| **系统**   |                                      |                           |               |
| GET        | `/health`                            | 健康检查                  | -             |
| GET        | `/health/ready`                      | 就绪检查 (含 DB)          | -             |

### 6.2 上传流程

```text
客户端 ─── POST /files/upload/init ──→ 服务端
       ←── { mode: "direct"|"chunked", chunk_size, upload_id }

[direct]  客户端 ─── POST /files/upload (multipart) ──→ 服务端
[chunked] 客户端 ─── PUT  /files/upload/{id}/{0..n} ──→ 服务端 (并发3)
                 ─── POST /files/upload/{id}/complete ──→ 服务端
                     (服务端: 流式拼接 + sha256 → 去重 → 存储)
```

---

## 7. TODO

### P1 — 近期

- [ ] **自定义属性系统** — `entity_properties` 表，统一服务 WebDAV PROPPATCH 和应用层自定义字段（schema 见下方 7.1）
- [ ] **WebDAV PROPPATCH** — 接 entity_properties 表，实现 `have_props`/`get_props`/`patch_props`
- [ ] **前端重构** — 网格视图、文件预览（图片/PDF/文本查看器）、搜索、整体 UX 提升

### P2 — 中期

- [ ] **分享页缩略图** — `GET /api/v1/s/{token}/thumbnail` 公开端点
- [ ] **回收站** — 软删除，误删可恢复
- [ ] **WebDAV 隐藏文件可配置** — 从 system*config 读过滤规则（当前硬编码 `.*_`/`~$_`/`.DS_Store`），管理员可调
- [ ] **API 大文件流式下载** — `file_service::download` 当前也全量缓冲，改为 `get_stream` + actix streaming response

### P3 — 远期

- [ ] **S3 presigned 直传** — upload_mode 策略选项，客户端直传 S3 跳过后端中转
- [ ] **Prometheus 指标** — 请求计数、延迟、存储用量、WebDAV 连接数
- [ ] **WebDAV 持久化锁** — DB-backed `DavLockSystem` 替代 MemLs（重启不丢锁）
- [ ] **更多存储驱动** — OSS/COS 等（S3 协议已覆盖大部分场景）

### 7.1 自定义属性系统设计（待实现）

统一的实体属性存储，同时服务 WebDAV PROPPATCH 和应用层自定义字段：

```sql
CREATE TABLE entity_properties (
    id          INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,       -- "file" | "folder"
    entity_id   INTEGER NOT NULL,
    namespace   TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    value       TEXT,
    UNIQUE(entity_type, entity_id, namespace, name)
);
```

命名空间约定：

- `""` (空): 应用内置属性 (tags, description, starred)
- `aster:`: 管理员自定义字段
- `DAV:`: WebDAV 标准属性（只读，计算得出，不存表）
- 其他 URI: WebDAV PROPPATCH 写入

两个入口共享同一张表：WebDAV `patch_props` 和 REST API 都读写 entity_properties。

---

## 8. 开发路线

### Phase 1: 核心链路 (MVP) — 完成

- 项目骨架、错误系统、配置加载
- 数据库连接 + 迁移
- Entity + Repository + 用户认证 (JWT)
- 本地存储驱动 + 文件上传/下载/删除 + 文件夹 CRUD

### Phase 2: 存储策略 — 完成

- StoragePolicy CRUD (Admin API)
- S3 驱动 + 用户-策略分配 + 文件夹级策略覆盖
- 文件去重 (sha256 + ref_count) + 配额管理
- 管理后台前端

### Phase 3: 分享 & 缓存 — 完成

- 分享链接 (密码保护 + 过期 + 下载限制)
- Moka 缓存层 + Redis 可选
- 分片上传 (服务端协商 + 并发上传 + 断点续传)
- Service 层统一 &AppState 重构 + 缓存集成

### Phase 4: 扩展 — 进行中

- [x] 缩略图生成 (WebP, 懒生成, per-blob)
- [x] WebDAV (dav-server, Class 1 + LOCK, Basic Auth + JWT)
- [x] WebDAV 大文件优化 (临时文件流式处理, 零拷贝 put_file)
- [x] WebDAV macOS 兼容性 (.\__/~$_/.DS_Store 过滤)
- [x] WebDAV MemLs 单例锁 (进程内共享)
- [ ] 自定义属性系统 + PROPPATCH
- [ ] 前端重构
- [ ] S3 presigned 直传
- [ ] Prometheus 指标
