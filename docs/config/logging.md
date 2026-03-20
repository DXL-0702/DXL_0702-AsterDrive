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
| `format` | string | `"text"` | 输出格式：`"text"` 或 `"json"` |
| `file` | string | `""` | 日志文件路径，留空表示仅输出到 stdout |

## JSON 格式

生产环境推荐使用 JSON 格式，便于日志收集系统（ELK、Loki 等）解析：

```toml
[logging]
format = "json"
file = "/var/log/asterdrive.log"
```

## 环境变量覆盖

```bash
ASTER__LOGGING__LEVEL=debug
```
