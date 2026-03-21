# 核心流程

这一页把当前版本最常见的操作流程串起来，便于从“能跑起来”过渡到“按产品方式使用”。

## 1. 管理员初始化

第一个注册的用户会自动成为管理员。管理员通常需要完成三件事：

- 检查系统默认存储策略
- 为用户分配存储策略和配额
- 根据需要设置运行时开关，例如回收站保留天数

相关页面与接口：

- 前端：`/admin/users`、`/admin/policies`、`/admin/settings`
- API：`/api/v1/admin/*`

## 2. 存储策略生效顺序

文件真正落到哪里，取决于下面这条链路：

```text
文件夹 policy_id -> 用户默认策略 -> 系统默认策略
```

这允许你把不同用户或不同目录分配到不同后端，例如：

- 默认走本地磁盘
- 某些团队目录单独走 S3
- 某个用户单独配置更大的配额

## 3. 小文件与大文件上传

当前系统有两种上传路径：

- 直传：`POST /api/v1/files/upload`
- 分片上传：`/files/upload/init -> PUT chunk -> complete`

推荐流程是先调用协商接口：

```text
POST /api/v1/files/upload/init
```

服务端会根据目标策略的 `chunk_size` 和文件大小，返回：

- `mode = "direct"`：走普通 multipart 上传
- `mode = "chunked"`：按返回的分片大小上传

## 4. 文件覆盖、版本与锁

版本并不是每次普通上传都会生成。当前实现中，历史版本主要来自覆盖写入流程，例如 WebDAV 客户端直接覆盖已有文件。

相关能力：

- 查看版本：`GET /api/v1/files/{id}/versions`
- 恢复版本：`POST /api/v1/files/{id}/versions/{version_id}/restore`
- 删除版本：`DELETE /api/v1/files/{id}/versions/{version_id}`
- 简单锁定：`POST /api/v1/files/{id}/lock` 或 `POST /api/v1/folders/{id}/lock`

管理员还能查看和清理底层资源锁：

- `GET /api/v1/admin/locks`
- `DELETE /api/v1/admin/locks/{id}`
- `DELETE /api/v1/admin/locks/expired`

## 5. 分享

分享支持文件与文件夹两种资源类型，且都支持：

- 密码
- 过期时间
- 下载次数上限

典型流程：

1. 调用 `POST /api/v1/shares` 创建分享
2. 将生成的 token 拼成公开地址
3. 若有密码，公开访问者先调用 `POST /api/v1/s/{token}/verify`
4. 再下载文件或浏览分享文件夹

前端公开页路径为 `/s/:token`。

## 6. WebDAV

WebDAV 不是直接复用用户登录密码，而是单独维护一套账号：

- 创建账号：`POST /api/v1/webdav-accounts`
- 测试凭据：`POST /api/v1/webdav-accounts/test`
- 启用/停用：`POST /api/v1/webdav-accounts/{id}/toggle`

创建时可选 `root_folder_id`，把该账号限制在某个目录树下。

默认挂载地址：

```text
http://<host>:3000/webdav
```

## 7. 删除、恢复与彻底清理

普通删除不会直接删除物理内容，而是进入回收站：

- 删除文件：`DELETE /api/v1/files/{id}`
- 删除文件夹：`DELETE /api/v1/folders/{id}`

然后可以：

- 查看回收站：`GET /api/v1/trash`
- 恢复：`POST /api/v1/trash/{entity_type}/{id}/restore`
- 彻底删除：`DELETE /api/v1/trash/{entity_type}/{id}`
- 清空回收站：`DELETE /api/v1/trash`

后台还会按 `trash_retention_days` 每小时清理一次过期条目。
