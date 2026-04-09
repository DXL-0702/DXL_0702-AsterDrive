# 系统设置

系统设置是管理员在后台直接维护的全站选项。  
大多数改动都不需要改 `config.toml`，也不需要重启服务。

后台入口：

```text
管理 -> 系统设置
```

## 先认识这些分组

当前页面会按下面这些分组显示：

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

其中：

- `邮件投递` 单独写在 [邮件](/config/mail)
- 你最常用的通常是 `站点配置`、`用户管理`、`登录与会话`、`存储`、`WebDAV`

## 最常改的项目

| 你想做什么 | 位置 |
| --- | --- |
| 改站点对外地址，让分享链接、邮件链接和某些预览地址都指向正确域名 | `站点配置 -> 公开站点地址` |
| 改浏览器标题、favicon 和 Logo | `站点配置` |
| 关闭公开注册 | `用户管理 -> 允许公开注册新用户` |
| 给新用户和新团队一个默认配额 | `用户管理 -> 新用户默认配额` |
| 调整 Access / Refresh Token 有效期 | `登录与会话` |
| 调整激活邮件、改绑邮箱、密码重置链接有效期 | `登录与会话` |
| 调整回收站保留时间、历史版本数量、团队归档保留时间 | `存储` |
| 关闭 WebDAV | `WebDAV -> 启用 WebDAV` |
| 开启或关闭审计日志 | `审计日志` |
| 配跨域（CORS） | `网络` |

## 当前内置设置

### 站点配置

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `public_site_url` | `""` | 对外真实访问地址，例如 `https://drive.example.com` |
| `branding_title` | `AsterDrive` | 登录页、分享页和应用页的浏览器标题 |
| `branding_description` | `Self-hosted cloud storage` | 登录前即可暴露的页面描述 |
| `branding_favicon_url` | `/favicon.svg` | 公开页面 favicon |
| `branding_wordmark_dark_url` | `/static/asterdrive/asterdrive-dark.svg` | 浅色背景区域使用的 Logo |
| `branding_wordmark_light_url` | `/static/asterdrive/asterdrive-light.svg` | 深色背景区域使用的 Logo |
| `gravatar_base_url` | `https://www.gravatar.com/avatar` | Gravatar 头像基础地址 |

### 用户管理

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `auth_allow_user_registration` | `true` | 是否允许外部用户从登录页公开注册 |
| `default_storage_quota` | `0` | 新建对象的默认配额，`0` 表示不限制 |
| `avatar_dir` | `avatar` | 上传头像的本地目录；相对路径会解析到 `./data/` 下面 |

`default_storage_quota` 当前会同时影响：

- 新创建的用户
- 新创建的团队

如果之后给某个用户或团队单独改了配额，就以单独设置为准。

### 登录与会话

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `auth_cookie_secure` | `true` | 是否只允许浏览器通过 HTTPS 发送认证和分享验证 Cookie |
| `auth_access_token_ttl_secs` | `900` | Access Token 有效期，单位秒 |
| `auth_refresh_token_ttl_secs` | `604800` | Refresh Token 有效期，单位秒 |
| `auth_register_activation_ttl_secs` | `86400` | 注册激活链接有效期，单位秒 |
| `auth_contact_change_ttl_secs` | `86400` | 邮箱改绑确认链接有效期，单位秒 |
| `auth_password_reset_ttl_secs` | `3600` | 密码重置链接有效期，单位秒 |
| `auth_contact_verification_resend_cooldown_secs` | `60` | 重新发送激活或改绑邮件的冷却时间，单位秒 |
| `auth_password_reset_request_cooldown_secs` | `60` | 同一账号重复申请密码重置邮件的冷却时间，单位秒 |

### 网络

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `cors_enabled` | `false` | 是否主动处理浏览器跨域请求 |
| `cors_allowed_origins` | `""` | 允许跨域访问的来源列表 |
| `cors_allow_credentials` | `false` | 跨域时是否允许带凭据 |
| `cors_max_age_secs` | `3600` | 浏览器缓存预检结果的秒数 |

### 存储、WebDAV 和审计日志

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `max_versions_per_file` | `10` | 单个文件最多保留多少个历史版本 |
| `trash_retention_days` | `7` | 回收站项目保留天数 |
| `team_archive_retention_days` | `7` | 已归档团队保留天数 |
| `webdav_enabled` | `true` | 是否对外提供 WebDAV |
| `audit_log_enabled` | `true` | 是否记录审计日志 |
| `audit_log_retention_days` | `90` | 审计日志保留天数 |

## 修改后什么时候生效

- 站点地址、标题、Logo、favicon：新打开或刷新后的页面按新值显示
- 公开注册开关：登录页会立即按新规则切换
- Cookie 安全策略和 Token 有效期：新登录、刷新和分享密码验证会立即按新值生效
- 激活、改绑和密码重置链接有效期：之后新发出的邮件按新规则生效
- 默认配额：只影响之后新创建的用户和团队
- 头像目录：后续新上传头像写到新目录；已存在头像仍按旧路径读取
- 回收站、团队归档和审计日志保留时间：后台清理任务会按新值工作
- 历史版本数量：新版本产生时按新规则裁剪
- WebDAV 开关：立即生效
- CORS：新请求立即按新规则响应

## CORS 什么时候才需要动

只有在这些场景下，你通常才需要改 CORS：

- 浏览器页面和 AsterDrive 不在同一个域名下
- 你要让别的站点在浏览器里直接调用 AsterDrive

大多数“页面和接口都在同一个站点里”的部署，不需要改这里。

如果你填写 `cors_allowed_origins`：

- 多个来源用英文逗号分隔
- 只写来源，不要带路径
- `*` 不能和具体来源混写
- 如果写成 `*`，就不能同时开启 `cors_allow_credentials`

## 关于“自定义配置”

后台里也可以新增自定义配置项。  
如果你只是正常维护 AsterDrive，优先改内置设置就够了。
