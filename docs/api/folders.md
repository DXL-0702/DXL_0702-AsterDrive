# 文件夹 API

以下路径都相对于 `/api/v1`，且都需要认证。

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/folders` | 列出根目录内容 |
| `POST` | `/folders` | 创建文件夹 |
| `GET` | `/folders/{id}` | 列出指定文件夹内容 |
| `PATCH` | `/folders/{id}` | 重命名、移动或切换策略 |
| `DELETE` | `/folders/{id}` | 软删除文件夹 |
| `POST` | `/folders/{id}/lock` | 简单锁定或解锁 |
| `POST` | `/folders/{id}/copy` | 递归复制文件夹 |

## `GET /folders`

返回根目录内容：

```json
{
  "folders": [],
  "files": []
}
```

## `POST /folders`

请求体：

```json
{
  "name": "Documents",
  "parent_id": null
}
```

`parent_id = null` 表示在根目录创建。

## `GET /folders/{id}`

读取指定文件夹下的文件夹和文件列表。

## `PATCH /folders/{id}`

请求体：

```json
{
  "name": "New Name",
  "parent_id": 3,
  "policy_id": 2
}
```

字段含义：

- `name`：重命名
- `parent_id`：移动到其他父目录
- `policy_id`：给该目录绑定存储策略

当前实现还会做这些校验：

- 不能把文件夹移动到自己下面
- 不能把文件夹移动到自己的子孙目录下
- 目标位置出现同名文件夹会报错

## `DELETE /folders/{id}`

删除是软删除，会递归标记子文件和子文件夹进入回收站。

## `POST /folders/{id}/lock`

请求体：

```json
{ "locked": true }
```

## `POST /folders/{id}/copy`

请求体：

```json
{ "parent_id": 10 }
```

服务端会递归复制整个目录树，并自动处理副本命名冲突。
