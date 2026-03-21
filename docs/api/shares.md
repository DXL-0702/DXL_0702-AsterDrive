# 分享 API

分享接口分成两类：

- 认证后管理自己的分享
- 公开访问分享内容

以下路径都相对于 `/api/v1`。

## 认证分享接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/shares` | 创建分享 |
| `GET` | `/shares` | 列出当前用户创建的分享 |
| `DELETE` | `/shares/{id}` | 删除分享 |

### `POST /shares`

请求体：

```json
{
  "file_id": 1,
  "folder_id": null,
  "password": "123456",
  "expires_at": "2026-03-31T12:00:00Z",
  "max_downloads": 10
}
```

注意：

- 推荐在 `file_id` 和 `folder_id` 中二选一
- 当前实现至少要求其中一个非空
- 同一资源只允许存在一个活跃分享；已过期旧分享会被自动清理
- `max_downloads = 0` 表示不限下载次数

## 公开分享接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/s/{token}` | 读取分享公开信息 |
| `POST` | `/s/{token}/verify` | 校验分享密码 |
| `GET` | `/s/{token}/download` | 下载分享文件 |
| `GET` | `/s/{token}/content` | 浏览分享文件夹内容 |
| `GET` | `/s/{token}/thumbnail` | 获取分享文件缩略图 |

### `GET /s/{token}`

返回公开信息：

- 名称
- 分享类型：`file` 或 `folder`
- 是否有密码
- 过期时间
- 下载次数与浏览次数

### `POST /s/{token}/verify`

请求体：

```json
{ "password": "123456" }
```

成功后会写入一个 1 小时有效的 HttpOnly Cookie，用于后续公开访问。

### `GET /s/{token}/download`

仅适用于文件分享。

如果分享受密码保护，则必须先完成 `/verify`。

### `GET /s/{token}/content`

仅适用于文件夹分享。

### `GET /s/{token}/thumbnail`

仅适用于图片文件分享。

## 前端公开页

对应的前端访问路径是：

```text
/s/:token
```
