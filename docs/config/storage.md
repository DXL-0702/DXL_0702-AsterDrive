# 存储策略

存储策略不在 `config.toml` 中配置，而是持久化在数据库里，通过 [管理 API](/api/admin) 维护。

## 概念

`StoragePolicy` 决定：

- 文件存储在哪个后端
- 上传时是否启用分片
- 单文件大小上限
- 默认根路径或对象前缀

首次启动时，如果系统里还没有任何策略，会自动创建默认本地策略。

## 支持的驱动类型

| 类型 | 说明 |
|------|------|
| `local` | 本地文件系统 |
| `s3` | S3 兼容对象存储 |

## 策略解析顺序

```text
文件夹 policy_id -> 用户默认策略 -> 系统默认策略
```

## 关键字段

| 字段 | 说明 |
|------|------|
| `driver_type` | `local` 或 `s3` |
| `endpoint` | S3 兼容服务地址 |
| `bucket` | S3 bucket |
| `base_path` | 本地目录或对象存储前缀 |
| `max_file_size` | 单文件大小上限，`0` 表示不限制 |
| `chunk_size` | 分片大小，`0` 表示关闭分片上传 |
| `is_default` | 是否为系统默认策略 |

## 上传模式判定

服务端会根据文件大小与 `chunk_size` 决定上传模式：

- `chunk_size == 0`：禁用分片
- `total_size <= chunk_size`：返回 `direct`
- `total_size > chunk_size`：返回 `chunked`

## 默认本地策略

自动创建的默认策略具有这些特征：

- 名称：`Local Default`
- 驱动：`local`
- 路径：`data/uploads`
- 默认分片大小：`5 MiB`

## 创建策略示例

```bash
curl -X POST http://localhost:3000/api/v1/admin/policies \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-s3",
    "driver_type": "s3",
    "endpoint": "https://s3.amazonaws.com",
    "bucket": "my-bucket",
    "access_key": "AKIA...",
    "secret_key": "...",
    "base_path": "asterdrive/"
  }'
```

## 当前实现注意事项

- `POST /api/v1/admin/policies` 请求体虽然包含 `chunk_size` 字段，但当前创建逻辑会先写入固定默认值 `5 MiB`
- 如果要精确调整分片大小，建议创建后再调用 `PATCH /api/v1/admin/policies/{id}`
- 连接测试支持“测试现有策略”和“测试临时参数”两种方式
