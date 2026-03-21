# API 概览

除健康检查外，所有 REST 接口都挂在：

```text
/api/v1
```

## 响应格式

统一响应包装如下：

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

字段含义：

- `code`：数字错误码，`0` 表示成功
- `msg`：错误消息；成功时通常为空
- `data`：响应体，部分成功接口会省略

## 错误码分域

| 范围 | 含义 |
|------|------|
| `0` | 成功 |
| `1000-1099` | 通用错误 |
| `2000-2099` | 认证错误 |
| `3000-3099` | 文件/上传/锁/缩略图错误 |
| `4000-4099` | 存储策略与驱动错误 |
| `5000-5099` | 文件夹错误 |
| `6000-6099` | 分享错误 |

## 认证方式

当前仓库使用三种认证模式：

- 浏览器/API：HttpOnly Cookie
- API 客户端：`Authorization: Bearer <jwt>`
- WebDAV：`Authorization: Basic ...` 或 Bearer JWT

## OpenAPI 与 Swagger

当前代码的行为分两类：

- debug 构建：注册 `/swagger-ui` 与 `/api-docs/openapi.json`
- release 构建：不注册 Swagger UI

前端使用的静态 OpenAPI 文件可通过下面命令生成：

```bash
cargo test --test generate_openapi
```

## 模块索引

- [认证](/api/auth)
- [文件](/api/files)
- [文件夹](/api/folders)
- [分享](/api/shares)
- [回收站](/api/trash)
- [WebDAV](/api/webdav)
- [属性](/api/properties)
- [管理](/api/admin)
- [健康检查](/api/health)
