# 日志配置

```toml
[logging]
level = "info"
format = "text"
file = ""
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `level` | string | `"info"` | 日志级别：`trace`、`debug`、`info`、`warn`、`error` |
| `format` | string | `"text"` | 输出格式：`text` 或 `json` |
| `file` | string | `""` | 日志文件路径；留空时输出到 stdout |

## 环境变量优先级

日志初始化时会优先尝试读取 `RUST_LOG`，如果没有再回退到 `logging.level`。

例如：

```bash
RUST_LOG=debug
```

也可以继续使用配置系统环境变量：

```bash
ASTER__LOGGING__LEVEL=debug
```

## JSON 输出

生产环境推荐：

```toml
[logging]
level = "info"
format = "json"
file = "/var/log/asterdrive.log"
```

## 文件不可写时的行为

如果 `logging.file` 无法打开，当前实现会：

- 发出 warning
- 自动回退到 stdout
