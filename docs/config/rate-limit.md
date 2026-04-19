# 访问限流

::: tip 这一篇覆盖 `[rate_limit]`
默认关闭。打开后按访问来源 IP 对登录、公开访问、API、写操作分别限流。
**反向代理后面慎用**——很容易把所有用户当成同一个来源，限流到自己。
:::

```toml
[rate_limit]
enabled = false

[rate_limit.auth]
seconds_per_request = 2
burst_size = 5

[rate_limit.public]
seconds_per_request = 1
burst_size = 30

[rate_limit.api]
seconds_per_request = 1
burst_size = 120

[rate_limit.write]
seconds_per_request = 2
burst_size = 10
```

## 什么时候建议开

- 服务直接暴露在公网
- 想拦登录入口的暴力尝试
- 想拦公开分享页被频繁探测
- 想控制高成本写操作的瞬时压力

## 四组规则分别管什么

| 分组 | 作用 |
| --- | --- |
| `auth` | 登录、注册、刷新令牌、分享密码验证等敏感操作 |
| `public` | 公开分享页和匿名访问 |
| `api` | 已登录用户的大多数日常操作 |
| `write` | 批量操作、管理后台等高成本写操作 |

## 两个旋钮怎么理解

| 设置项 | 作用 |
| --- | --- |
| `seconds_per_request` | 平均多久允许一次请求（令牌补充速率） |
| `burst_size` | 短时间内允许的突发请求数（令牌桶上限） |

例：

```toml
[rate_limit.auth]
seconds_per_request = 2
burst_size = 5
```

同一来源 IP 在认证类访问上可以**先连续发出 5 个请求**，之后按"每 2 秒一个"补充配额。

## 触发后用户看到什么

- 服务端返回 `429 Too Many Requests`
- 响应头带 `Retry-After`
- 前端会显示"稍后再试"

## 反向代理场景一定要注意

::: warning 应用层限流看的是连接来源 IP
当前版本的应用层限流，按 AsterDrive **实际看到的连接来源 IP** 工作。

如果你的部署是：

- Nginx / Caddy 反代到 AsterDrive
- Docker 网桥
- 任何让所有请求都从同一个代理地址进入的网络拓扑

那应用层限流很可能把所有用户都当成同一个来源——个用户触发，所有人一起被限。
:::

这类部署里更稳的做法：

- 关掉 AsterDrive 应用层限流，主要限流交给反向代理（Nginx `limit_req`、Caddy `rate_limit`、Traefik `RateLimit` 中间件）
- 或者继续在应用层限，但把 `burst_size` 调得很宽

## 几条经验

- 第一次启用保守一点，`burst_size` 别设太小
- 对外开放公开分享页时，重点关注 `auth` 和 `public`
- 不确定时先在测试环境观察一段时间再上
