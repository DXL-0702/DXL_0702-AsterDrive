# 启动后的运行时行为

这一页专门说明：AsterDrive 成功启动以后，系统会自动做哪些事。

这不是部署脚本的理想设计，而是当前仓库已经落地的真实行为。

## 1. 配置加载

启动时会先加载环境变量与静态配置：

- 读取 `.env`
- 读取 `config.toml`
- 如果当前工作目录不存在 `config.toml`，自动生成一份默认配置

优先级：

```text
ASTER__ 环境变量 > config.toml > 内置默认值
```

## 2. 数据库初始化与 migration

连接数据库后，服务会自动执行全部 migration。

这意味着：

- 不需要额外手工先跑迁移
- 应用启动账号必须具备建表 / 改表权限
- readiness 也会依赖数据库连通性

## 3. 默认存储策略初始化

如果系统里还没有任何存储策略，启动时会自动创建默认本地策略：

- 名称：`Local Default`
- 驱动：`local`
- 路径：`data/uploads`

所以第一次启动后，即使你还没进管理后台，也已经有一条可用的本地存储策略。

## 4. 运行时配置初始化

AsterDrive 还有一层数据库内的运行时配置 `system_config`。

启动时会自动把内置配置定义写入数据库，但不会覆盖管理员已经改过的值。

典型项包括：

- `webdav_enabled`
- `max_versions_per_file`
- `trash_retention_days`
- `default_storage_quota`
- `audit_log_enabled`
- `audit_log_retention_days`

## 5. 路由注册

启动完成后会同时提供这些入口：

- REST API：`/api/v1/*`
- 健康检查：`/health*`
- WebDAV：默认 `/webdav`
- 前端页面：管理面板与公开分享页

另外还有两个条件化入口：

- `/swagger-ui`：仅 `debug` 构建
- `/health/metrics`：仅启用 `metrics` feature 的构建

## 6. 前端资源加载顺序

当前实现不是只靠一种前端交付方式。

运行期会按这个顺序找前端资源：

1. 先看当前工作目录下的 `./frontend-panel/dist`
2. 如果没有，再回退到编译时嵌入进二进制的前端资源
3. 如果构建期连前端产物都没有，则显示回退页

这也是为什么工作目录会影响部署结果。

## 7. 后台任务

启动后，服务会自动拉起每小时执行一次的后台任务：

- 清理过期上传 session
- 清理过期回收站条目
- 清理过期资源锁
- 清理过期审计日志

这些任务属于应用内置行为，不需要额外再配 crontab。

## 8. 首次使用后的默认状态

对新部署实例来说，通常还会有这些默认结果：

- 第一个注册用户自动成为管理员
- 新用户会自动分配当前默认存储策略
- 默认监听地址是 `127.0.0.1:3000`
- 默认 WebDAV 前缀是 `/webdav`

## 9. 部署后最应该先验什么

建议启动后马上检查：

1. `/health` 是否返回 200
2. `/health/ready` 是否返回 200
3. `config.toml` 是否在预期目录生成
4. 数据库是否在预期位置创建并完成迁移
5. 默认存储策略是否已经存在
6. 管理后台是否能正常打开
7. 如果打算用 WebDAV，挂载路径是否与配置一致

## 相关文档

- [部署概览](/deployment/)
- [Docker 部署](/deployment/docker)
- [systemd 部署](/deployment/systemd)
- [配置概览](/config/)
- [架构概览](/architecture)
