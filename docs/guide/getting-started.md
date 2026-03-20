# 快速开始

## 启动服务

```bash
./aster_drive
```

首次启动会自动生成 `config.toml` 和 SQLite 数据库文件。服务默认监听 `http://127.0.0.1:3000`。

## 注册账号

第一个注册的用户自动成为管理员。

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@example.com", "password": "your-password"}'
```

## 登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "admin", "password": "your-password"}'
```

登录成功后，access token 和 refresh token 通过 HttpOnly Cookie 返回。

## 上传文件

```bash
curl -X POST http://localhost:3000/api/v1/files/upload \
  -b cookies.txt \
  -F "file=@/path/to/file.pdf"
```

## 访问前端

浏览器打开 `http://localhost:3000` 即可访问内置的 Web 文件管理界面。

## 查看 API 文档

访问 `http://localhost:3000/swagger-ui` 查看完整的 OpenAPI 文档。
