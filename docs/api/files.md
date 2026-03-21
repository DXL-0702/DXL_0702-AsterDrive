# 文件 API

以下路径都相对于 `/api/v1`，且都需要认证。

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/files/upload` | 直传文件，`multipart/form-data` |
| `POST` | `/files/upload/init` | 协商上传模式，决定直传或分片 |
| `PUT` | `/files/upload/{upload_id}/{chunk_number}` | 上传单个分片 |
| `POST` | `/files/upload/{upload_id}/complete` | 组装分片并创建文件 |
| `GET` | `/files/upload/{upload_id}` | 查询分片上传进度 |
| `DELETE` | `/files/upload/{upload_id}` | 取消分片上传 |
| `GET` | `/files/{id}` | 获取文件元信息 |
| `GET` | `/files/{id}/download` | 下载文件 |
| `GET` | `/files/{id}/thumbnail` | 获取缩略图 |
| `PATCH` | `/files/{id}` | 重命名或移动文件 |
| `DELETE` | `/files/{id}` | 软删除到回收站 |
| `POST` | `/files/{id}/lock` | 简单锁定或解锁 |
| `POST` | `/files/{id}/copy` | 复制文件 |
| `GET` | `/files/{id}/versions` | 列出历史版本 |
| `POST` | `/files/{id}/versions/{version_id}/restore` | 恢复某个版本 |
| `DELETE` | `/files/{id}/versions/{version_id}` | 删除某个版本 |

## 直传

### `POST /files/upload`

查询参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `folder_id` | `i64?` | 目标文件夹；为空时表示根目录 |

请求体使用 `multipart/form-data`。

注意：

- 文件名冲突会报错，不会覆盖
- 普通删除不会立刻删物理文件，而是进入回收站

## 协商式分片上传

### `POST /files/upload/init`

请求体：

```json
{
  "filename": "archive.zip",
  "total_size": 5368709120,
  "folder_id": 12
}
```

服务端根据目标存储策略返回：

- `mode = "direct"`：客户端应退回普通 multipart 直传
- `mode = "chunked"`：返回 `upload_id`、`chunk_size`、`total_chunks`

### `PUT /files/upload/{upload_id}/{chunk_number}`

- `chunk_number` 从 `0` 开始
- 请求体使用 `application/octet-stream`
- 该接口对已存在的分片是幂等的

### `POST /files/upload/{upload_id}/complete`

完成后服务端会：

1. 组装临时文件
2. 计算 SHA-256
3. 检查大小和配额
4. 执行去重
5. 创建最终文件记录

### `GET /files/upload/{upload_id}`

返回上传状态、已接收分片数和磁盘上已存在的分片编号，可用于断点续传。

## 普通文件操作

### `GET /files/{id}`

读取文件元信息。

### `GET /files/{id}/download`

流式下载文件，响应会带：

- `Content-Type`
- `Content-Length`
- `Content-Disposition: attachment`

### `PATCH /files/{id}`

请求体：

```json
{
  "name": "renamed.pdf",
  "folder_id": 5
}
```

两个字段都可选。

### `DELETE /files/{id}`

这是软删除，文件会进入回收站。

## 缩略图

### `GET /files/{id}/thumbnail`

仅支持图片文件，当前返回 WebP 格式。

不支持的 MIME 类型会返回缩略图错误。

## 锁与复制

### `POST /files/{id}/lock`

请求体：

```json
{ "locked": true }
```

这是一层简化的 REST 锁接口。底层真实锁记录仍保存在 `resource_locks` 表中。

### `POST /files/{id}/copy`

请求体：

```json
{ "folder_id": 8 }
```

`folder_id` 为空时复制到原目录并自动处理命名冲突。

## 版本历史

历史版本主要来自覆盖写入流程，例如 WebDAV 覆盖已有文件。

### `GET /files/{id}/versions`

返回该文件当前保存的历史版本数组。

### `POST /files/{id}/versions/{version_id}/restore`

把当前文件切回指定历史版本。

### `DELETE /files/{id}/versions/{version_id}`

删除指定历史版本；若其底层 Blob 不再被引用，会连带清理物理内容。
