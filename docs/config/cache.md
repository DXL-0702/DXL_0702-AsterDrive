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
| --- | --- | --- | --- |
| `enabled` | bool | `true` | 是否启用缓存 |
| `backend` | string | `"memory"` | 缓存后端，支持 `memory` 与 `redis` |
| `redis_url` | string | `""` | Redis 连接地址，仅 `backend = "redis"` 时使用 |
| `default_ttl` | u64 | `3600` | 默认 TTL，单位秒 |

## 当前缓存用途

当前缓存主要用于：

- `policy:{id}`
- `user_default_policy:{user_id}`

也就是存储策略与用户默认策略解析链。

## 后端实现

- `memory`：基于 `moka`
- `redis`：基于 `redis-rs`
- `enabled = false`：退化为 `NoopCache`

## Redis 初始化失败时的行为

如果配置了 Redis 但连接初始化失败，服务不会中止，而是自动回退到内存缓存。

## 什么时候需要 Redis

- 单机、小规模部署：默认 `memory` 通常就够用
- 多实例部署：如果你希望不同实例之间共享缓存命中，才有必要切到 `redis`
- 如果你只是想先把服务跑起来，不必为了缓存额外引入 Redis

## 关闭缓存

```toml
[cache]
enabled = false
```
