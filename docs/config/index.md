# 配置概览

AsterDrive 当前有两层配置面：

- 静态配置：`config.toml` 与 `ASTER__` 环境变量
- 运行时配置：数据库表 `system_config`

首次启动时，如果当前工作目录不存在 `config.toml`，服务会自动生成一份默认配置。

## 优先级

```text
环境变量 (ASTER__ 前缀) > config.toml > 代码默认值
```

环境变量使用双下划线 `__` 表示层级：

```bash
ASTER__SERVER__PORT=8080
ASTER__DATABASE__URL="postgres://user:pass@localhost/asterdrive"
ASTER__WEBDAV__PREFIX=/dav
```

## 当前静态配置分区

| 分区 | 作用 |
| --- | --- |
| [server](/config/server) | 监听地址、端口、工作线程 |
| [database](/config/database) | 数据库连接、连接池、启动重试 |
| [auth](/config/auth) | JWT 密钥、token 生命周期 |
| [cache](/config/cache) | 内存缓存 / Redis / 关闭缓存 |
| [logging](/config/logging) | 日志级别、格式、输出文件 |
| [webdav](/config/webdav) | WebDAV 路由前缀和请求体硬上限 |
| [storage](/config/storage) | 数据库存储策略模型与解析规则 |

## 当前真正生效的运行时配置

| Key | 作用 |
| --- | --- |
| `default_storage_quota` | 新注册用户的默认总配额 |
| `webdav_enabled` | 是否启用 WebDAV |
| `trash_retention_days` | 回收站保留天数 |
| `max_versions_per_file` | 单文件最大历史版本数 |
| `audit_log_enabled` | 是否记录审计日志 |
| `audit_log_retention_days` | 审计日志保留天数 |

运行时配置由管理员通过 `/api/v1/admin/config/*` 在线维护，详情见 [运行时配置](/config/runtime)。

## 三类配置各自适合放什么

| 类型 | 放什么 | 典型示例 |
| --- | --- | --- |
| 静态配置 | 影响启动与路由注册的参数 | 监听地址、数据库 URL、JWT 密钥、日志格式、WebDAV 前缀 |
| 运行时配置 | 允许管理员在线调整的业务开关 | WebDAV 开关、回收站保留期、版本保留数、审计日志保留期 |
| 存储策略 | 文件写入哪个后端以及怎么上传 | local / s3、`base_path`、`chunk_size`、`presigned_upload` |

## 当前生成的默认配置

下面这份内容来自 `src/config/schema.rs` 的默认值，而不是旧示例文件。

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0

[database]
url = "sqlite://asterdrive.db?mode=rwc"
pool_size = 10
retry_count = 3

[auth]
jwt_secret = "<首次启动自动生成>"
access_token_ttl_secs = 900
refresh_token_ttl_secs = 604800

[cache]
enabled = true
backend = "memory"
redis_url = ""
default_ttl = 3600

[logging]
level = "info"
format = "text"
file = ""

[webdav]
prefix = "/webdav"
payload_limit = 10737418240
```

## 路径语义

代码固定从当前工作目录读取 `config.toml`。这会影响：

- 配置文件默认位置
- 默认 SQLite 文件位置
- 相对路径形式的本地存储目录
- 运行时优先读取的 `./frontend-panel/dist`

部署时请始终先确定工作目录，再决定挂载方案。

## 继续阅读

- [服务器](/config/server)
- [存储策略](/config/storage)
- [运行时配置](/config/runtime)
- [WebDAV](/config/webdav)
