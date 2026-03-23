# 日志配置

```toml
[logging]
level = "info"
format = "text"
file = ""
```

## 字段说明

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `level` | string | `"info"` | 日志级别：`trace`、`debug`、`info`、`warn`、`error` |
| `format` | string | `"text"` | 输出格式：`text` 或 `json` |
| `file` | string | `""` | 日志文件路径；留空时输出到 stdout |

## 优先级

日志初始化时会优先读取 `RUST_LOG`，如果没有再回退到 `logging.level`。

例如：

```bash
RUST_LOG=debug
```

也可以继续通过配置系统环境变量覆盖：

```bash
ASTER__LOGGING__LEVEL=debug
```

## 不合法值和文件不可写时的行为

当前代码会尽量降级而不是直接启动失败：

- `logging.level` 非法：回退到 `info`
- `logging.file` 打不开：回退到 stdout

这些回退都会产生 warning。

## 生产环境建议

```toml
[logging]
level = "info"
format = "json"
file = "/var/log/asterdrive.log"
```

补充建议：

- 容器部署优先输出到 stdout，再交给 Docker / Kubernetes / Loki / ELK 收集
- `json` 更适合集中式日志系统；`text` 更适合本地排障
- 审计日志和普通运行日志不是一回事：审计日志写数据库，运行日志走 tracing 输出
