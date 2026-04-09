# 配置总览

管理员日常会碰到 5 类配置：

- `config.toml`：决定服务怎么启动
- `管理 -> 系统设置`：决定账号、会话、站点地址、品牌、邮件、回收站、版本历史、WebDAV 和审计日志这类全站行为
- `管理 -> 存储策略`：决定文件真正存到哪里
- `管理 -> 策略组`：决定不同用户、团队或文件大小该走哪条存储路线
- 反向代理 / 对象存储自身配置：决定 HTTPS、大文件上传和 S3 浏览器直传是否能用

先把这几层分清，后面就不会把“部署问题”改到后台里，也不会把“用户规则”硬塞回 `config.toml`。

## 先判断你要改哪一层

| 你想做什么 | 去哪里改 |
| --- | --- |
| 改监听地址、端口、线程数、临时目录 | [服务器](/config/server) |
| 改数据库地址、连接池或启动重试 | [数据库](/config/database) |
| 固定 JWT 密钥，或决定第一次纯 HTTP 引导怎么处理 | [登录与会话](/config/auth) |
| 改公开注册、Cookie 安全策略、Token 有效期、回收站、版本历史、WebDAV 开关、审计日志 | [系统设置](/config/runtime) |
| 改 SMTP、发件人、测试邮件、邮件模版 | [邮件](/config/mail) |
| 改公开站点地址、浏览器标题、Logo、favicon | [系统设置](/config/runtime) |
| 改文件真正存放的位置 | [存储策略](/config/storage) |
| 改用户或团队上传走哪条存储路线 | [存储策略与策略组](/config/storage) |
| 改 WebDAV 路径或 WebDAV 上传硬上限 | [WebDAV](/config/webdav) |
| 想限制公网访问频率 | [访问限流](/config/rate-limit) |
| 改缓存或日志输出方式 | [缓存](/config/cache)、[日志](/config/logging) |

## `config.toml` 在哪里

首次启动时，如果当前工作目录里还没有 `config.toml`，AsterDrive 会自动生成一份默认配置。

只想改少数几项时，不需要把整份默认配置全部抄出来。  
`config.toml` 里只写你要覆盖的字段即可。

配置优先级：

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
| [server](/config/server) | 监听地址、端口、线程数、临时目录 |
| [database](/config/database) | 数据库连接、连接池、启动重试 |
| [auth](/config/auth) | JWT 密钥、首次纯 HTTP 引导 |
| [cache](/config/cache) | 内存缓存 / Redis / 关闭缓存 |
| [logging](/config/logging) | 日志级别、格式、输出文件与轮转 |
| [webdav](/config/webdav) | WebDAV 路径前缀和上传体积硬上限 |
| [rate_limit](/config/rate-limit) | 登录、公开分享和一般访问的限流规则 |

## 后台系统设置里最常改什么

`管理 -> 系统设置` 现在会按这些分组展示：

- 站点配置
- 用户管理
- 登录与会话
- 邮件投递
- 网络
- 存储
- WebDAV
- 审计日志
- 自定义配置
- 其他

最常见的改法通常是：

- 对外上线前，先填 `公开站点地址`
- 想开放公开注册、找回密码或邮箱改绑前，先把邮件发通
- 纯 HTTP 测试环境才临时关闭 Cookie 安全要求
- 容量紧张时缩短回收站和历史版本保留
- 不打算开放 WebDAV 时，直接在这里关掉

详情见 [系统设置](/config/runtime) 和 [邮件](/config/mail)。

## 存储策略和策略组不在 `config.toml` 里

存储策略和策略组都在后台页面里维护，不写在 `config.toml` 里。

它们分别决定：

- 存储策略：文件真正存到哪里、单文件大小和上传方式
- 策略组：用户或团队上传时，应该命中哪一条存储策略

详情见 [存储策略](/config/storage)。

## 路径一定要想清楚

如果你使用相对路径，当前工作目录会影响：

- `config.toml` 的位置
- SQLite 数据库文件的位置
- 本地上传目录的位置
- 临时目录 `data/.tmp` 和 `data/.uploads` 的位置

例如：

- 本地直接运行：跟你执行命令的目录有关
- systemd：跟 `WorkingDirectory` 有关
- Docker 官方镜像：默认相对路径会落到容器里的 `/`

长期部署时，如果你不想以后被工作目录影响，数据库路径、本地存储路径和临时目录最好都写成绝对路径。
