# 文件编辑

AsterDrive 支持通过 WebDAV 和 REST API 两种方式编辑文件，统一使用锁→读→改→写→解锁流程。

## 编辑会话生命周期

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  LOCK   │ ──► │  READ   │ ──► │  EDIT   │ ──► │  SAVE   │ ──► │ UNLOCK  │
│(可选)    │     │  + ETag │     │ (本地)   │     │ + ETag  │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
```

1. **LOCK**（可选）— 悲观锁定文件，防止并发编辑
2. **READ** — 下载文件内容，获取 ETag（blob hash）
3. **EDIT** — 用户在本地或浏览器中编辑
4. **SAVE** — 上传修改内容，带 `If-Match: {etag}` 检测冲突
5. **UNLOCK** — 释放锁

## 两种锁策略

### 悲观锁（Pessimistic Locking）

适用场景：WebDAV 客户端（cadaver、Office）、长时间编辑

```
客户端 A: LOCK → GET → [编辑 30 分钟] → PUT → UNLOCK
客户端 B: 尝试写入 → 423 Locked（被拒绝）
```

- 通过 `POST /api/v1/files/{id}/lock` 或 WebDAV `LOCK` 方法获取
- 文件 `is_locked=true` 期间，非锁持有者不能修改/删除/移动
- 锁有超时（WebDAV 默认 1 小时），过期自动释放
- 锁持有者 + 文件所有者 + Admin 可以解锁

### 乐观锁（Optimistic Locking）

适用场景：Web 编辑器、快速保存

```
客户端 A: GET (etag="abc") → [编辑] → PUT If-Match:"abc" → 200 OK
客户端 B: GET (etag="abc") → [编辑] → PUT If-Match:"abc" → 412 Conflict
```

- 通过 HTTP `ETag` / `If-Match` 标准机制
- 不需要显式锁定，不阻塞其他读者
- 保存时比对 ETag：匹配则更新，不匹配则返回 412
- 客户端收到 412 后可以选择强制覆盖或合并

### 组合使用

推荐的 Web 编辑器流程同时使用两种锁：

```
1. POST /files/{id}/lock     → 悲观锁，防止其他人编辑
2. GET  /files/{id}/download → 获取内容 + ETag
3. [用户编辑]
4. PUT  /files/{id}/content  → If-Match: {etag}，乐观锁兜底
5. POST /files/{id}/lock     → { locked: false } 释放锁
```

悲观锁防止并发编辑，乐观锁检测自己编辑期间文件是否被（强制）修改过。

## REST API

### 下载文件（带 ETag）

```http
GET /api/v1/files/{id}/download
Authorization: Bearer {token}
```

响应：
```http
200 OK
ETag: "sha256hash..."
Content-Type: application/octet-stream

{file content}
```

### 覆盖文件内容

```http
PUT /api/v1/files/{id}/content
Authorization: Bearer {token}
If-Match: "sha256hash..."    (可选，乐观锁)
Content-Type: application/octet-stream

{new content}
```

响应：
```http
200 OK
ETag: "newsha256hash..."
Content-Type: application/json

{ "code": 0, "data": { ...file model... } }
```

错误：
- `412 Precondition Failed` — ETag 不匹配（文件已被修改）
- `423 Locked` — 文件被其他人锁定
- `404 Not Found` — 文件不存在
- `403 Forbidden` — 无权限

### 锁定/解锁

```http
POST /api/v1/files/{id}/lock
Content-Type: application/json

{ "locked": true }   // 锁定
{ "locked": false }  // 解锁
```

## WebDAV 编辑流程

WebDAV 客户端（cadaver `edit`、Office、Finder）使用标准 RFC4918 流程：

```
LOCK   /webdav/file.txt  → 200 + Lock-Token
GET    /webdav/file.txt  → 200 + 文件内容
[本地编辑器修改]
PUT    /webdav/file.txt  → If: (<lock-token>) → 200/204
UNLOCK /webdav/file.txt  → Lock-Token header → 200/204
```

WebDAV 编辑自动创建版本历史（`store_from_temp` 中的覆盖分支）。

## 冲突处理

| 场景 | 检测 | HTTP | 客户端行为 |
|------|------|------|-----------|
| 文件被其他用户锁定 | `is_locked` | 423 | 等待或请求文件所有者解锁 |
| 保存时内容已变化 | `If-Match` ETag | 412 | 重新加载 → 手动合并 |
| 无 `If-Match` header | 跳过检测 | 200 | 强制覆盖（无冲突检测） |

## 版本历史

每次通过 `PUT /files/{id}/content` 或 WebDAV PUT 覆盖文件时，旧内容自动保存为历史版本：

- 版本数上限由 `max_versions_per_file` 系统配置控制（默认 10）
- 超出上限时自动清理最旧版本
- 可通过 `GET /files/{id}/versions` 查看版本列表
- 可通过 `POST /files/{id}/versions/{version_id}/restore` 恢复

## 架构

```
                    ┌──────────────────────┐
                    │   store_from_temp()  │  ← 公共入口
                    │   (file_service.rs)  │
                    └────────┬─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ WebDAV PUT │  │ REST PUT   │  │ REST POST  │
     │ (flush)    │  │ /content   │  │ /upload    │
     └────────────┘  └────────────┘  └────────────┘
              │              │              │
              │    ┌─────────┘              │
              ▼    ▼                        ▼
     ┌────────────────┐           ┌────────────────┐
     │ 覆盖 (版本溯源) │           │ 新建 (无版本)   │
     └────────────────┘           └────────────────┘
```

所有写入路径最终都走 `store_from_temp()`，当 `existing_file_id` 有值时自动创建版本。
