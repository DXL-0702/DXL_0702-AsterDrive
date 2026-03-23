# 部署概览

AsterDrive 的生产交付形态是：

- 单个 Rust 二进制
- 或基于该二进制构建的容器镜像

前端已经打包并嵌入后端，不需要再额外部署独立静态站点。

## 推荐部署方式

| 方式 | 场景 |
| --- | --- |
| [Docker](/deployment/docker) | 单机、NAS、小规模部署 |
| [systemd](/deployment/systemd) | 裸机、云主机、长期运行服务 |
| 直接运行二进制 | 开发、调试、快速验证 |

## 部署前先确认的三件事

### 1. 工作目录与相对路径

当前代码固定从当前工作目录读取和解析：

- `config.toml`
- 默认 SQLite 路径
- 默认本地存储目录 `data/uploads`
- 运行时前端覆盖目录 `./frontend-panel/dist`

所以无论你用 systemd 还是容器，都要先确定“当前工作目录到底是哪”。

### 2. JWT 密钥

生产环境必须固定 `auth.jwt_secret`，否则服务重启后所有登录态都会失效。

### 3. 数据持久化

至少要持久化以下内容之一：

- 数据库
- 本地上传目录
- 配置文件

如果你继续使用默认相对路径，这些位置都会受工作目录影响。

## 启动后会自动发生什么

只要服务成功启动，当前实现还会自动完成这些初始化动作：

- 加载 `.env`，再读取 `config.toml`
- 如果当前工作目录不存在 `config.toml`，自动生成一份默认配置
- 连接数据库并自动执行全部 migration
- 如果系统里还没有任何存储策略，自动创建默认本地策略 `Local Default`
- 自动向 `system_config` 写入内置运行时配置默认值
- 启动后台清理任务，例如上传 session、回收站、资源锁和审计日志清理

## 部署时真正要区分的三类配置

- 静态配置：`config.toml` 与 `ASTER__` 环境变量，主要控制监听地址、数据库、JWT、日志、WebDAV 前缀等
- 运行时配置：数据库表 `system_config`，由管理后台在线维护，例如 `webdav_enabled`、回收站保留天数、版本保留数量
- 存储策略：数据库中的 `storage_policies`，决定文件实际落盘位置、驱动类型、上传模式和大小限制

不要把“存储策略”和 `config.toml` 混成一件事。前者是业务数据，后者是静态启动配置。

## 当前构建特性对部署的影响

- `/swagger-ui` 只在 `debug` 构建存在
- `/health/metrics` 只在启用了 `metrics` feature 的构建存在
- 前端若未构建，后端仍能启动，但首页只会显示回退页
- 运行期会优先读取 `./frontend-panel/dist`；若不存在，再回退到嵌入二进制中的前端资源

## 生产环境建议

1. 固定 `auth.jwt_secret`
2. 明确工作目录
3. 为数据库与上传目录做持久化
4. 如果想把 SQLite 和本地上传放进同一个持久卷，优先把数据库 URL 改到 `/data` 之类的稳定路径
5. 如果使用 WebDAV，确认代理层允许相关方法和请求头
6. 如果使用 S3/MinIO 并开启 `presigned_upload`，确认对象存储侧已配置浏览器 `PUT` 所需的 CORS
7. 用 `/health` 和 `/health/ready` 作为部署后的基础验收接口

## 继续阅读

- [Docker 部署](/deployment/docker)
- [systemd 部署](/deployment/systemd)
- [反向代理](/deployment/proxy)
- [启动后的运行时行为](/deployment/runtime-behavior)
