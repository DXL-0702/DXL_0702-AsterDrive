# 回收站 API

以下路径都相对于 `/api/v1`，且都需要认证。

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/trash` | 列出回收站内容 |
| `POST` | `/trash/{entity_type}/{id}/restore` | 恢复单个文件或文件夹 |
| `DELETE` | `/trash/{entity_type}/{id}` | 彻底删除单个文件或文件夹 |
| `DELETE` | `/trash` | 清空当前用户回收站 |

其中 `entity_type` 只能是：

- `file`
- `folder`

## `GET /trash`

返回结构：

```json
{
  "folders": [],
  "files": []
}
```

## `POST /trash/{entity_type}/{id}/restore`

恢复时有一个当前实现细节：

- 如果原父目录已经不存在或也在回收站中，资源会被恢复到根目录

文件夹恢复会递归恢复它的子项。

## `DELETE /trash/{entity_type}/{id}`

这是永久删除：

- 文件会处理 Blob 引用计数、缩略图和配额回收
- 文件夹会递归永久删除整棵目录树

## `DELETE /trash`

批量清空当前用户回收站，并返回清理数量。

## 后台保留期清理

除了显式 purge，系统还会根据运行时配置 `trash_retention_days` 每小时清理一次过期条目。
