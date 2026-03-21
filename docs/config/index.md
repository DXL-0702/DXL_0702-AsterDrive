# 配置概览

AsterDrive 当前有两层配置面：

- 静态配置：`config.toml` 与 `ASTER__` 环境变量
- 运行时配置：数据库表 `system_config`

首次启动时，如果当前工作目录不存在 `config.toml`，服务会自动生成一份默认配置。

## 配置优先级

```text
环境变量 (ASTER__ 前缀) > config.toml > 默认值
```

环境变量使用双下划线 `__` 分隔层级：

```bash
ASTER__SERVER__PORT=8080
ASTER__DATABASE__URL="postgres://user:pass@localhost/asterdrive"
```

## 静态配置分区

| 分区 | 说明 |
|------|------|
| [server](/config/server) | 监听地址、端口、工作线程 |
| [database](/config/database) | 数据库连接、连接池 |
| [auth](/config/auth) | JWT 密钥、token 有效期 |
| [cache](/config/cache) | 缓存后端和 TTL |
| [logging](/config/logging) | 日志级别、格式、输出 |
| [webdav](/config/webdav) | WebDAV 前缀与请求体硬上限 |
| [storage](/config/storage) | 数据库存储的策略模型与解析规则 |

## 运行时配置

运行时配置保存在数据库，由管理员通过 `/api/v1/admin/config/*` 在线维护。

当前实现中应重点关注：

- [运行时配置项](/config/runtime)
- `webdav_enabled`
- `trash_retention_days`
- `max_versions_per_file`

## 完整默认配置

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
jwt_secret = "<自动生成的随机密钥>"
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

## 配置文件路径约定

代码当前固定从当前工作目录读取 `config.toml`，没有额外的命令行参数可覆盖路径。

这意味着：

- 本地直接运行时，配置文件应放在执行目录
- systemd 场景下，`WorkingDirectory` 会决定配置文件位置
- 容器场景下，镜像工作目录与挂载路径必须和这一行为保持一致
