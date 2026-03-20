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
| `retry_count` | u32 | `3` | 连接失败重试次数 |

## 支持的数据库

AsterDrive 通过 sea-orm 支持多种数据库，连接字符串会自动推断数据库类型。

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

## 迁移

数据库迁移在启动时自动执行，无需手动操作。
