# 缓存配置

```toml
[cache]
enabled = true
backend = "memory"
redis_url = ""
default_ttl = 3600
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `true` | 是否启用缓存 |
| `backend` | string | `"memory"` | 缓存后端：`"memory"` 或 `"redis"` |
| `redis_url` | string | `""` | Redis 连接地址，仅 `backend = "redis"` 时需要 |
| `default_ttl` | u64 | `3600` | 默认缓存 TTL（秒） |

## Memory 缓存

使用 [moka](https://github.com/moka-rs/moka) 作为本地内存缓存，适合单实例部署。

## Redis 缓存

多实例部署时使用 Redis 作为共享缓存：

```toml
[cache]
backend = "redis"
redis_url = "redis://localhost:6379"
```
