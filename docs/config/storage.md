# 存储策略

存储策略不在 `config.toml` 中配置，而是存储在数据库中，通过 [Admin API](/api/admin) 管理。

## 概念

StoragePolicy 定义了文件存储在哪里：用什么驱动、什么 endpoint、什么 bucket、文件大小限制等。

首次启动时，系统自动创建一个默认的本地存储策略。

## 支持的驱动类型

| 类型 | 说明 |
|------|------|
| `local` | 本地文件系统 |
| `s3` | S3 兼容存储（AWS S3、MinIO、Cloudflare R2 等） |

## 策略优先级

```
文件夹级 policy_id → 用户级默认策略 → 系统全局默认策略
```

## 创建存储策略示例

```bash
# 创建 S3 策略
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

详见 [Admin API](/api/admin) 了解完整的策略管理接口。
