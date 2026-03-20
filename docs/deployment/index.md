# 部署概览

AsterDrive 是单二进制应用，部署方式灵活。

## 部署方式

| 方式 | 适用场景 |
|------|----------|
| [Docker](/deployment/docker) | 推荐，最简单 |
| [systemd](/deployment/systemd) | Linux 服务器裸机部署 |
| 直接运行 | 开发和测试 |

## 生产环境建议

1. **固定 JWT 密钥** — 避免重启后 token 失效
2. **使用反向代理** — Nginx/Caddy 处理 TLS 和静态缓存
3. **持久化数据** — 挂载数据目录和配置文件
4. **配置日志** — JSON 格式 + 文件输出，便于收集

## 最小化配置

```toml
[server]
host = "0.0.0.0"

[auth]
jwt_secret = "your-production-secret-at-least-32-chars"
```

其他配置使用默认值即可。
