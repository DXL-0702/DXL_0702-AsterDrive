# WebDAV 配置

WebDAV 相关配置分成两部分：

- 静态配置：`config.toml` 中的 `[webdav]`
- 运行时开关：数据库 `system_config` 中的 `webdav_enabled`

## 静态配置

```toml
[webdav]
prefix = "/webdav"
payload_limit = 10737418240
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | string | `"/webdav"` | WebDAV 路径前缀，修改后需要重启 |
| `payload_limit` | usize | `10737418240` | WebDAV 请求体硬上限，默认 10 GiB |

## 认证方式

WebDAV 当前支持两种认证头：

- `Authorization: Basic ...`
  - 使用独立的 `webdav_accounts` 账号体系
  - 可限制到某个根文件夹
- `Authorization: Bearer <jwt>`
  - 复用普通登录后的 JWT
  - 访问范围为该用户的全部空间

## 路由行为

WebDAV 路由注册顺序在前端 fallback 之前，因此：

- `/webdav` 不会被 SPA 路由吞掉
- `prefix` 修改后，客户端挂载地址也要同步修改

## 反向代理要求

如果 WebDAV 在反向代理后面，请确保代理层不会丢失：

- `Authorization`
- WebDAV 方法，例如 `PROPFIND`、`LOCK`、`UNLOCK`、`MOVE`、`COPY`
- 相关头，例如 `Depth`、`Destination`、`Overwrite`、`Lock-Token`

完整示例见 [反向代理部署](/deployment/proxy)。
