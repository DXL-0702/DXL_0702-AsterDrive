# 管理 API

以下路径都相对于 `/api/v1`，且都需要管理员权限。

## 存储策略

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/policies` | 列出全部存储策略 |
| `POST` | `/admin/policies` | 创建存储策略 |
| `GET` | `/admin/policies/{id}` | 读取策略详情 |
| `PATCH` | `/admin/policies/{id}` | 更新策略 |
| `DELETE` | `/admin/policies/{id}` | 删除策略 |
| `POST` | `/admin/policies/{id}/test` | 测试已保存策略 |
| `POST` | `/admin/policies/test` | 用临时参数测试连接 |

### 创建策略示例

```json
{
  "name": "archive-s3",
  "driver_type": "s3",
  "endpoint": "https://s3.example.com",
  "bucket": "archive",
  "access_key": "AKIA...",
  "secret_key": "...",
  "base_path": "asterdrive/",
  "max_file_size": 10737418240,
  "chunk_size": 10485760,
  "is_default": false
}
```

注意：当前创建逻辑会先把 `chunk_size` 写成默认值 `5 MiB`，若要精确调整，建议创建后再 `PATCH`。

## 用户与用户策略

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/users` | 列出用户 |
| `GET` | `/admin/users/{id}` | 获取用户详情 |
| `PATCH` | `/admin/users/{id}` | 更新角色、状态、总配额 |
| `GET` | `/admin/users/{user_id}/policies` | 列出用户绑定的策略 |
| `POST` | `/admin/users/{user_id}/policies` | 给用户分配策略 |
| `PATCH` | `/admin/users/{user_id}/policies/{id}` | 更新用户策略项 |
| `DELETE` | `/admin/users/{user_id}/policies/{id}` | 删除用户策略项 |

### 更新用户示例

```json
{
  "role": "user",
  "status": "active",
  "storage_quota": 107374182400
}
```

当前实现有一个保护规则：

- 初始管理员账号 `id = 1` 不能被禁用
- 初始管理员账号 `id = 1` 不能被降级为非管理员

### 分配用户策略示例

```json
{
  "policy_id": 3,
  "is_default": true,
  "quota_bytes": 53687091200
}
```

`quota_bytes` 是该用户在该策略上的额度。

## 系统运行时配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/config` | 列出全部运行时配置 |
| `GET` | `/admin/config/{key}` | 获取单个配置项 |
| `PUT` | `/admin/config/{key}` | 设置配置项 |
| `DELETE` | `/admin/config/{key}` | 删除配置项 |

### 设置配置项示例

```json
{
  "value": "14"
}
```

## 分享审计

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/shares` | 查看全站分享 |
| `DELETE` | `/admin/shares/{id}` | 管理员删除任意分享 |

## 锁管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/locks` | 查看全部资源锁 |
| `DELETE` | `/admin/locks/{id}` | 强制解锁 |
| `DELETE` | `/admin/locks/expired` | 清理全部过期锁 |

这些锁主要服务于 WebDAV 与覆盖写入流程。
