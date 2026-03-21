# 快速开始

## 1. 启动服务

```bash
cargo run
```

首次启动时会自动完成这些动作：

- 在当前工作目录生成 `config.toml`
- 创建默认 SQLite 数据库
- 执行数据库迁移
- 如果系统里没有任何存储策略，自动创建默认本地策略 `Local Default`

服务默认监听 `http://127.0.0.1:3000`。

## 2. 注册第一个账号

第一个注册的用户自动成为管理员。

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@example.com", "password": "your-password"}'
```

## 3. 登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username": "admin", "password": "your-password"}'
```

登录成功后，access token 和 refresh token 通过 HttpOnly Cookie 返回。

## 4. 打开前端

浏览器访问：

```text
http://localhost:3000
```

前端默认包含这些页面：

- 文件浏览器
- 回收站
- WebDAV 账号管理
- 管理员后台：用户、策略、分享、锁、系统设置
- 公开分享页 `/s/:token`

## 5. 上传文件

```bash
curl -X POST http://localhost:3000/api/v1/files/upload \
  -b cookies.txt \
  -F "file=@/path/to/file.pdf"
```

如果是大文件客户端，推荐先调用：

```text
POST /api/v1/files/upload/init
```

由服务端决定当前文件应当走直传还是分片上传。

## 6. 创建分享

```bash
curl -X POST http://localhost:3000/api/v1/shares \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"file_id": 1, "password": "123456", "max_downloads": 10}'
```

公开访问接口位于：

```text
/api/v1/s/{token}
```

对应的前端公开页位于：

```text
/s/{token}
```

## 7. 查看服务状态

- `GET /health`：活性检查
- `GET /health/ready`：就绪检查，包含数据库连通性

## 8. 查看 OpenAPI

当前仓库中有两种方式：

- debug 构建下访问 `http://localhost:3000/swagger-ui`
- 通过 `cargo test --test generate_openapi` 生成静态规范文件

release 构建不会注册 Swagger UI。
