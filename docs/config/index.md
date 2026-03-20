# 配置概览

AsterDrive 使用 `config.toml` 作为配置文件，首次启动时自动生成。

## 配置优先级

```
环境变量 (ASTER__ 前缀) > config.toml > 默认值
```

环境变量使用双下划线 `__` 分隔层级：

```bash
ASTER__SERVER__PORT=8080
ASTER__DATABASE__URL="postgres://user:pass@localhost/asterdrive"
```

## 配置分区

| 分区 | 说明 |
|------|------|
| [server](/config/server) | 监听地址、端口、工作线程 |
| [database](/config/database) | 数据库连接、连接池 |
| [auth](/config/auth) | JWT 密钥、token 有效期 |
| [storage](/config/storage) | 存储策略（通过 Admin API 管理） |
| [cache](/config/cache) | 缓存后端和 TTL |
| [logging](/config/logging) | 日志级别、格式、输出 |

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
```
