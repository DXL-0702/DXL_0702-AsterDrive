# 服务器配置

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `host` | string | `"127.0.0.1"` | 绑定地址，容器或反向代理场景通常应设置为 `0.0.0.0` |
| `port` | u16 | `3000` | HTTP 监听端口 |
| `workers` | usize | `0` | Actix worker 数量，`0` 表示自动取 CPU 核心数 |

## 运行时行为

- HTTP 服务默认启用压缩中间件
- 常规二进制 payload 上限在代码中固定为 `10 MiB`
- JSON payload 上限在代码中固定为 `1 MiB`
- WebDAV 的请求体限制独立于上面两项，由 `[webdav].payload_limit` 控制

## 容器环境

容器中应至少覆盖：

```bash
ASTER__SERVER__HOST=0.0.0.0
```

## 常用环境变量

```bash
ASTER__SERVER__HOST=0.0.0.0
ASTER__SERVER__PORT=3000
ASTER__SERVER__WORKERS=4
```
