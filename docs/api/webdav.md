# WebDAV API 与访问方式

WebDAV 相关能力包括：

- 账号管理 REST API
- 实际的 WebDAV 挂载入口
- 与 WebDAV 相关的锁与属性能力

## 账号管理 API

以下路径都相对于 `/api/v1`，且都需要认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/webdav-accounts` | 列出当前用户的 WebDAV 账号 |
| `POST` | `/webdav-accounts` | 创建 WebDAV 账号 |
| `DELETE` | `/webdav-accounts/{id}` | 删除 WebDAV 账号 |
| `POST` | `/webdav-accounts/{id}/toggle` | 启用或停用账号 |
| `POST` | `/webdav-accounts/test` | 测试一组 WebDAV 凭据 |

### `POST /webdav-accounts`

请求体：

```json
{
  "username": "dav-demo",
  "password": null,
  "root_folder_id": 12
}
```

行为说明：

- `password` 为空时会自动生成 16 位随机密码
- 返回值里的明文密码只会在创建时返回一次
- `root_folder_id` 为空表示可访问该用户的全部空间

## 实际 WebDAV 挂载地址

默认地址为：

```text
/webdav
```

完整 URL 例如：

```text
http://localhost:3000/webdav
```

如果你改了 `[webdav].prefix`，挂载地址也会随之改变。

## 认证方式

当前实现支持：

- `Authorization: Basic ...`
  - 使用 `webdav_accounts` 里的专用用户名和密码
- `Authorization: Bearer <jwt>`
  - 复用普通登录 JWT，不受 `root_folder_id` 限制

## 目录访问范围

如果某个 WebDAV 账号设置了 `root_folder_id`：

- 根目录会被映射到该文件夹
- 客户端只能访问这个目录及其子目录

## 锁与属性

WebDAV 使用数据库锁系统与属性表：

- 锁记录保存在 `resource_locks`
- 自定义属性保存在 `entity_properties`
- 管理员可以通过 `/api/v1/admin/locks` 查看与清理锁
