# 部署概览

AsterDrive 的生产交付形态是：

- 单个 Rust 二进制
- 或基于该二进制构建的容器镜像

前端已经打包并嵌入后端，不需要再额外部署 Nginx 静态站点来承载管理面板。

## 推荐部署方式

| 方式 | 场景 |
|------|------|
| [Docker](/deployment/docker) | 单机或小规模部署，最省事 |
| [systemd](/deployment/systemd) | 裸机、云主机、NAS |
| 直接运行二进制 | 开发、调试、一次性验证 |

## 部署前要明确的三件事

### 1. 工作目录

当前代码默认：

- 从当前工作目录读取 `config.toml`
- 默认 SQLite 也落在当前工作目录
- 默认本地存储策略写到相对路径 `data/uploads`

所以无论你选 systemd 还是容器，都需要明确“工作目录与挂载目录的对应关系”。

### 2. JWT 密钥

生产环境必须固定 `auth.jwt_secret`，否则服务重启后所有登录态都会失效。

### 3. 反向代理

如果需要 HTTPS、自定义域名或 WebDAV 客户端接入，通常都应该放一个反向代理在前面。

## 生产环境建议

1. 固定 `auth.jwt_secret`
2. 为数据目录、配置文件和数据库做持久化
3. 使用反向代理处理 TLS
4. 如果需要 WebDAV，确认代理不会丢失 `Authorization` 和 WebDAV 相关头
5. 若需要指标采集，使用启用了 `metrics` feature 的构建
