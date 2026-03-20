# AsterDrive

自托管云存储系统，基于 Rust + React 构建。

单二进制部署，可插拔存储后端，多数据库支持。

## 功能特性

- **单二进制部署** - 前端通过 `rust-embed` 嵌入，无需额外 Web 服务器
- **多数据库** - SQLite（默认）、MySQL、PostgreSQL，基于 sea-orm
- **可插拔存储** - 本地文件系统和 S3 兼容后端，通过存储策略驱动
- **JWT 认证** - 基于 HttpOnly Cookie 的认证，支持 access/refresh token 自动轮换
- **文件去重** - SHA-256 内容哈希 + 引用计数
- **文件夹系统** - 层级文件夹，支持文件夹级别的存储策略覆盖
- **管理员 API** - 存储策略 CRUD 管理
- **OpenAPI 文档** - Swagger UI 自动生成，访问 `/swagger-ui`
- **请求限流** - 认证接口独立限流配置
- **结构化日志** - 支持 text/JSON 格式输出，可配置级别和文件输出

## 快速开始

```bash
# 构建并运行（首次启动自动生成 config.toml）
cargo run

# 或者用 Docker
docker compose up -d
```

服务默认启动在 `http://127.0.0.1:3000`。第一个注册用户自动成为管理员。

## 配置

首次启动时，AsterDrive 自动生成 `config.toml`，包含合理的默认值和随机 JWT 密钥。

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0              # 0 = 自动检测 CPU 核心数

[database]
url = "sqlite://asterdrive.db?mode=rwc"
pool_size = 10
retry_count = 3

[auth]
jwt_secret = "<自动生成>"
access_token_ttl_secs = 900       # 15 分钟
refresh_token_ttl_secs = 604800   # 7 天

[cache]
enabled = true
backend = "memory"       # "memory" 或 "redis"
redis_url = ""
default_ttl = 3600

[logging]
level = "info"
format = "text"          # "text" 或 "json"
file = ""                # 留空 = 仅输出到 stdout
```

所有配置项均可通过 `ASTER__` 前缀的环境变量覆盖：

```bash
ASTER__SERVER__PORT=8080
ASTER__DATABASE__URL="postgres://user:pass@localhost/asterdrive"
ASTER__AUTH__JWT_SECRET="your-secret-here"
```

## API 接口

所有接口路径前缀为 `/api/v1`。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/register` | 注册（首个用户 = 管理员） |
| `POST` | `/auth/login` | 登录，设置 HttpOnly Cookie |
| `POST` | `/auth/refresh` | 刷新 access token |
| `POST` | `/auth/logout` | 清除认证 Cookie |
| `GET` | `/auth/me` | 获取当前用户信息 |

### 文件（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/files/upload?folder_id=` | 上传文件（multipart） |
| `GET` | `/files/{id}` | 获取文件元信息 |
| `GET` | `/files/{id}/download` | 下载文件内容 |
| `PATCH` | `/files/{id}` | 重命名/移动文件 |
| `DELETE` | `/files/{id}` | 删除文件 |

### 文件夹（需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/folders` | 列出根目录内容 |
| `POST` | `/folders` | 创建文件夹 |
| `GET` | `/folders/{id}` | 列出文件夹内容 |
| `PATCH` | `/folders/{id}` | 重命名/移动/变更策略 |
| `DELETE` | `/folders/{id}` | 删除文件夹 |

### 管理（仅管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/admin/policies` | 列出所有存储策略 |
| `POST` | `/admin/policies` | 创建存储策略 |
| `GET` | `/admin/policies/{id}` | 获取策略详情 |
| `DELETE` | `/admin/policies/{id}` | 删除策略 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 存活检查 |
| `GET` | `/health/ready` | 就绪检查（包含数据库 ping） |

完整 OpenAPI 文档可在运行时访问 `/swagger-ui` 查看。

## 项目结构

```
src/
├── api/                HTTP 路由 + 中间件 + 响应类型
│   ├── error_code.rs   ErrorCode 枚举（数字码，按域分组）
│   ├── routes/         路由模块（auth, files, folders, admin, health）
│   └── middleware/     JwtAuth, CORS, RequestID
├── config/             配置加载（config.toml + ASTER__ 环境变量）
├── db/                 数据库连接 + repository 模式
├── entities/           Sea-ORM 实体（DeriveEntityModel）
├── errors.rs           AsterError 枚举（内部字符串码 E001-E040）
├── services/           业务逻辑层
├── storage/            StorageDriver trait + LocalDriver + S3Driver + DriverRegistry
├── types.rs            类型安全枚举（UserRole, UserStatus, DriverType, TokenType）
├── runtime/            启动、关闭、日志、panic hook
└── utils/              哈希、ID 工具

migration/              Sea-ORM 数据库迁移
frontend-panel/         React 前端（Vite + shadcn/ui + zustand）
docs/                   架构文档
```

## 开发

### 环境要求

- Rust 1.91.1+
- bun（前端构建）

### 命令

```bash
# 后端
cargo run                          # 启动服务
cargo check                        # 类型检查
cargo test --test api_integration  # 集成测试
cargo test --test generate_openapi # 生成 OpenAPI 文档

# 前端
cd frontend-panel
bun install
bun run dev                        # 开发模式（代理到 :3000）
bun run build                      # 生产构建（tsgo + vite）
bun run check                      # Lint（biome）
```

## Docker 部署

```bash
# 构建镜像
docker build -t asterdrive .

# 运行
docker run -d \
  -p 3000:3000 \
  -v asterdrive-data:/app/data \
  asterdrive

# 或者用 docker compose
docker compose up -d
```

详见 [docker-compose.yml](docker-compose.yml)。

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) - Copyright (c) 2026 AptS-1547
