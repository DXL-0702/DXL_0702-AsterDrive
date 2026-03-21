# 数据库配置

```toml
[database]
url = "sqlite://asterdrive.db?mode=rwc"
pool_size = 10
retry_count = 3
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | string | `"sqlite://asterdrive.db?mode=rwc"` | 数据库连接字符串 |
| `pool_size` | u32 | `10` | 连接池大小 |
| `retry_count` | u32 | `3` | 启动阶段数据库连接失败时的重试次数 |

## 支持的数据库

AsterDrive 通过 SeaORM 自动推断数据库类型并建立连接。

### SQLite（默认）

```toml
url = "sqlite://asterdrive.db?mode=rwc"
```

### PostgreSQL

```toml
url = "postgres://user:password@localhost:5432/asterdrive"
```

### MySQL

```toml
url = "mysql://user:password@localhost:3306/asterdrive"
```

## 启动时行为

- 自动建立数据库连接
- 自动执行全部迁移
- 迁移完成后再进入 HTTP/WebDAV 服务阶段

## 工作目录影响

默认 SQLite URL 使用相对路径，因此数据库文件会落在当前工作目录。

部署时请确保：

- systemd 明确设置 `WorkingDirectory`
- 容器内数据目录与工作目录约定一致
