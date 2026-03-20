# 管理 API

需要管理员权限。普通用户调用会返回 `403`。

## GET /admin/policies

列出所有存储策略。

**响应：** `200` 返回策略数组。

## POST /admin/policies

创建存储策略。

**请求体：**

```json
{
  "name": "my-s3",
  "driver_type": "s3",
  "endpoint": "https://s3.amazonaws.com",
  "bucket": "my-bucket",
  "access_key": "AKIA...",
  "secret_key": "...",
  "base_path": "asterdrive/",
  "max_file_size": 104857600,
  "is_default": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 策略名称 |
| `driver_type` | string | 是 | `"local"` 或 `"s3"` |
| `endpoint` | string | 否 | S3 endpoint |
| `bucket` | string | 否 | S3 bucket |
| `access_key` | string | 否 | S3 access key |
| `secret_key` | string | 否 | S3 secret key |
| `base_path` | string | 否 | 文件存储基础路径 |
| `max_file_size` | i64 | 否 | 最大文件大小（字节），0 = 无限 |
| `is_default` | bool | 否 | 是否为默认策略 |

## GET /admin/policies/{id} {#get-policy}

获取策略详情。

## DELETE /admin/policies/{id} {#delete-policy}

删除策略。正在使用的策略无法删除。
