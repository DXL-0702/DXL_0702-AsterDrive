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
| `backend` | string | `"memory"` | 缓存后端，支持 `memory` 与 `redis` |
| `redis_url` | string | `""` | Redis 连接地址，仅 `backend = "redis"` 时使用 |
| `default_ttl` | u64 | `3600` | 默认 TTL，单位秒 |

## 后端实现

- `memory`：基于 `moka`
- `redis`：基于 `redis-rs`
- 禁用缓存：使用 `NoopCache`

## Redis 回退行为

如果配置了 Redis 但连接初始化失败，当前实现不会阻止服务启动，而是自动回退到内存缓存。

## 关闭缓存

```toml
[cache]
enabled = false
```
