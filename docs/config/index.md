# 配置总览

这一组文档是给管理员看的，核心目标只有一个：让你知道“这个需求该去哪里改”。

在 AsterDrive 里，配置分成三层：

- `config.toml`：决定服务怎么启动
- 管理后台里的系统设置：决定 WebDAV、回收站、历史版本、审计日志这类全站行为
- 存储策略：决定文件真正存到哪里、怎么上传

先把这三层分清楚，后面就不容易改错地方。

## 先判断你要改哪一层

| 你想做什么 | 去哪里改 |
| --- | --- |
| 改监听地址、端口 | [服务器](/config/server) |
| 改数据库 | [数据库](/config/database) |
| 改登录密钥或 Cookie 行为 | [登录与会话](/config/auth) |
| 改文件真正存放的位置 | [存储策略](/config/storage) |
| 改 WebDAV 路径或上传硬上限 | [WebDAV](/config/webdav) |
| 改回收站、版本数、新用户默认配额、审计日志 | [系统设置](/config/runtime) |
| 给公网访问加限流 | [访问限流](/config/rate-limit) |
| 改缓存或日志输出方式 | [缓存](/config/cache)、[日志](/config/logging) |

## `config.toml` 会在哪里生效

首次启动时，如果当前工作目录不存在 `config.toml`，服务会自动生成一份默认配置。

只想改少数几项时，不需要把整份默认配置全部抄出来。`config.toml` 里只写你要覆盖的字段即可。

环境变量优先级更高：

```text
ASTER__ 环境变量 > config.toml > 内置默认值
```

环境变量使用双下划线 `__` 表示层级，例如：

```bash
ASTER__SERVER__PORT=8080
ASTER__DATABASE__URL="postgres://user:pass@localhost/asterdrive"
ASTER__WEBDAV__PREFIX=/dav
```

## `config.toml` 里有哪些分区

| 分区 | 作用 |
| --- | --- |
| [server](/config/server) | 监听地址、端口、工作线程 |
| [database](/config/database) | 数据库连接、连接池、启动重试 |
| [auth](/config/auth) | 登录密钥、会话有效期、Cookie 安全设置 |
| [cache](/config/cache) | 内存缓存 / Redis / 关闭缓存 |
| [logging](/config/logging) | 日志级别、格式、输出文件与轮转 |
| [webdav](/config/webdav) | WebDAV 路径前缀和上传体积上限 |
| [rate_limit](/config/rate-limit) | 登录、公开分享和一般 API 的限流规则 |

## 系统设置里最常改什么

管理员可以在后台直接调整这些常见设置：

| 设置项 | 作用 |
| --- | --- |
| 默认用户配额 | 新用户注册后默认能使用多少空间 |
| WebDAV 开关 | 是否允许 WebDAV 访问 |
| 回收站保留天数 | 已删除项目保留多久 |
| 历史版本数量 | 单个文件最多保留多少个旧版本 |
| 审计日志开关 | 是否记录关键操作 |
| 审计日志保留天数 | 审计日志保留多久 |
| Gravatar 头像地址 | 用户使用 Gravatar 时从哪里取头像 |

详情见 [系统设置](/config/runtime)。

## 存储策略是什么

存储策略不写在 `config.toml` 里，而是在管理后台里维护。它决定：

- 文件真正存到哪里
- 新用户和指定用户默认走哪条策略
- 上传时走普通上传、分片上传还是 S3 直传

详情见 [存储策略](/config/storage)。

## 路径这件事一定要搞清楚

如果你使用相对路径，当前工作目录会影响：

- `config.toml` 的位置
- 默认 SQLite 的位置
- 相对本地存储路径的位置

例如：

- 本地直接运行：跟你执行命令的目录有关
- systemd：跟 `WorkingDirectory` 有关
- Docker 镜像：默认会把自动生成的配置写到容器里的 `/config.toml`

长期部署时，如果你不想以后被工作目录影响，数据库路径和本地存储路径最好改成绝对路径。
