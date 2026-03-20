# 认证配置

```toml
[auth]
jwt_secret = "<自动生成>"
access_token_ttl_secs = 900       # 15 分钟
refresh_token_ttl_secs = 604800   # 7 天
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `jwt_secret` | string | 随机生成 | JWT 签名密钥，生产环境务必固定 |
| `access_token_ttl_secs` | u64 | `900` | Access token 有效期（秒） |
| `refresh_token_ttl_secs` | u64 | `604800` | Refresh token 有效期（秒） |

## 认证机制

- 登录后，access token 和 refresh token 通过 **HttpOnly Cookie** 下发
- Access token 过期后，前端自动调用 `/auth/refresh` 刷新
- `/auth/me` 同时支持 Cookie 和 `Authorization: Bearer` 头
- 密码使用 Argon2 哈希存储

## 生产环境注意事项

首次启动自动生成的 `jwt_secret` 是随机值。如果重启服务会导致所有已签发的 token 失效。

生产环境应在 `config.toml` 中固定密钥：

```toml
[auth]
jwt_secret = "your-fixed-secret-at-least-32-chars"
```
