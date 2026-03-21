# 认证 API

以下路径都相对于 `/api/v1`。

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/register` | 注册用户；第一个用户自动成为管理员 |
| `POST` | `/auth/login` | 登录并写入认证 Cookie |
| `POST` | `/auth/refresh` | 刷新 access token |
| `POST` | `/auth/logout` | 清除认证 Cookie |
| `GET` | `/auth/me` | 读取当前登录用户信息 |

## `POST /auth/register`

请求体：

```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "password"
}
```

成功返回创建后的用户信息。

## `POST /auth/login`

请求体：

```json
{
  "username": "admin",
  "password": "password"
}
```

成功后会设置两个 HttpOnly Cookie：

- `aster_access`
- `aster_refresh`

## `POST /auth/refresh`

使用 refresh Cookie 刷新 access token。

注意：

- 当前实现只读取 refresh Cookie
- 不支持通过 Bearer header 刷新

## `POST /auth/logout`

清除 `aster_access` 与 `aster_refresh` Cookie。

## `GET /auth/me`

支持两种方式：

- 浏览器通过 Cookie
- API 客户端通过 `Authorization: Bearer <jwt>`

## 限流

认证相关接口内置了轻量限流：

- `/auth/login`：每秒 1 次，突发 5
- `/auth/register`：每秒 1 次，突发 3
