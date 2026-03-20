# 认证 API

## POST /auth/register

注册新用户。第一个注册的用户自动成为管理员。

**请求体：**

```json
{ "username": "admin", "email": "admin@example.com", "password": "password" }
```

**响应：** `201` 返回用户信息。

## POST /auth/login

登录，成功后在响应中设置 `aster_access` 和 `aster_refresh` HttpOnly Cookie。

**请求体：**

```json
{ "username": "admin", "password": "password" }
```

**响应：** `200`

## POST /auth/refresh

使用 refresh cookie 刷新 access token。

**响应：** `200` 设置新的 access cookie。

## POST /auth/logout

清除认证 Cookie。

**响应：** `200`

## GET /auth/me

获取当前登录用户信息。支持 Cookie 或 Bearer token。

**响应：** `200` 返回用户信息。

## 限流

- `/auth/login`：每秒 1 次，突发 5 次
- `/auth/register`：每秒 1 次，突发 3 次
