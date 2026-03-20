# 文件 API

所有接口需要认证。

## POST /files/upload

上传文件（multipart/form-data）。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `folder_id` | i64? | 目标文件夹 ID，不传则上传到根目录 |

**响应：** `201` 返回文件信息。

## GET /files/{id} {#get-file}

获取文件元信息。

**响应：** `200` 返回文件信息（名称、大小、MIME 类型等）。

## GET /files/{id}/download

下载文件内容。

**响应：** `200` 返回文件二进制流。

## PATCH /files/{id} {#patch-file}

修改文件属性。

**请求体：**

```json
{ "name": "new-name.pdf", "folder_id": 5 }
```

所有字段可选，只传需要修改的。

## DELETE /files/{id} {#delete-file}

删除文件。如果对应的 Blob 引用计数降为 0，物理文件也会被删除。
