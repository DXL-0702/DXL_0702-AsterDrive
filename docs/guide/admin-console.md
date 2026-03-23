# 管理后台

这一页说明 AsterDrive 当前已经稳定提供的管理员能力，重点是后端真实支持的管理动作。

## 入口

第一个注册用户会自动成为 `admin`。

当前内置管理页面对应这些路由：

- `/admin/users`
- `/admin/policies`
- `/admin/shares`
- `/admin/locks`
- `/admin/settings`
- `/admin/audit`

前端界面后续可以调整，但下面这些管理能力已经由服务端实现。

## 当前管理后台已经覆盖什么

- 用户角色、状态、总配额
- 用户可用存储策略分配与默认策略
- 本地 / S3 存储策略管理与连通性测试
- 全站分享审计与删除
- 资源锁查看、强制解锁、过期锁清理
- `system_config` 在线维护与 schema 驱动表单
- 审计日志分页查询

## 用户管理

用户管理页主要做三件事：

- 调整角色和状态
- 修改总配额
- 必要时强制删除普通用户

保护规则也很简单：

- 初始管理员 `id = 1` 不能被禁用、降级或删除
- 其他管理员必须先降级为普通用户，才能被强制删除

强制删除是不可逆操作，会连同这个用户的文件、分享、WebDAV 账号、策略分配和上传会话一起清掉。

## 存储策略管理

存储策略页决定两件事：文件写到哪里、上传怎么走。

当前支持：

- `local`
- `s3`

前端已经接好：创建、编辑、设为默认、删除、测试已保存策略、测试临时参数。

需要记住的限制：

- 不能删除系统里唯一的默认策略
- 只要还有 Blob 引用该策略，就不能删除
- `PATCH /api/v1/admin/policies/{id}` 不能修改 `driver_type`
- 创建策略时 `chunk_size` 目前先写固定 `5 MiB`，真要改得创建后再改

## 用户存储策略分配

这页处理的是“某个用户能用哪些策略”。

需要分清两种额度：

- `storage_quota`：用户总额度
- `quota_bytes`：某条用户策略分配上的额度

另外还有两条规则：

- 一个用户只能有一个默认分配策略
- 不能移除用户唯一剩下的那条策略分配

策略解析顺序仍然是：

```text
文件夹策略 -> 用户默认策略 -> 系统默认策略
```

## 系统运行时配置

AsterDrive 现在有两层配置。

### 静态配置

`config.toml` 负责启动期配置，例如：

- 服务监听地址和端口
- 数据库连接
- JWT 配置
- 缓存后端
- 日志
- WebDAV 前缀和 payload 上限

### 运行时配置

`system_config` 表负责在线可调的运行时配置，不需要改 `config.toml`。

当前内置系统配置项：

| Key | 类型 | 作用 |
| --- | --- | --- |
| `webdav_enabled` | boolean | 控制 WebDAV 是否接受请求；关闭后返回 `503` |
| `max_versions_per_file` | number | 单文件最多保留多少历史版本 |
| `trash_retention_days` | number | 回收站自动清理窗口 |
| `default_storage_quota` | number | 新注册用户默认配额，单位字节 |

设置运行时配置：

```bash
curl -X PUT http://127.0.0.1:3000/api/v1/admin/config/trash_retention_days \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"value":"14"}'
```

补充说明：

- 系统配置会做类型校验
- 系统配置不允许删除
- 管理员可以创建自定义配置项，供插件或自定义前端使用
- 系统配置的 schema 可通过 `/api/v1/admin/config/schema` 读取
- 前端设置页会按 category 分组展示，并标记是否需要重启

## 审计日志

当前前端已经提供 `/admin/audit` 页面，对应后端也支持审计日志查询。

管理员可以：

- 分页查看关键操作
- 按 action 和 entity type 过滤
- 看到时间、用户、实体名称、IP 等字段

审计日志是否记录、保留多久，取决于运行时配置：

- `audit_log_enabled`
- `audit_log_retention_days`

## WebDAV 锁管理

管理员可以查看并释放当前实例里的资源锁。

### 当前可做的事

- 列出全部锁
- 强制解锁单个资源
- 清理全部过期锁

清理过期锁：

```bash
curl -X DELETE http://127.0.0.1:3000/api/v1/admin/locks/expired \
  -b cookies.txt
```

强制解锁单个锁：

```bash
curl -X DELETE http://127.0.0.1:3000/api/v1/admin/locks/15 \
  -b cookies.txt
```

适用场景通常是某个 WebDAV 客户端异常退出，锁没有正常释放。需要注意的是，如果客户端还以为自己持有这把锁，强制释放后该客户端后续写入可能报错。

## 分享链接管理

管理员可以审计和删除全站分享。

### 当前可做的事

- 列出全部分享
- 查看文件分享或文件夹分享状态
- 查看分享是否过期，或是否达到下载次数上限
- 直接删除任意分享

删除一个分享：

```bash
curl -X DELETE http://127.0.0.1:3000/api/v1/admin/shares/9 \
  -b cookies.txt
```

删除后，公开链接会立即失效。
