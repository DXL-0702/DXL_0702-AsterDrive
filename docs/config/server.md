# 服务器配置

::: tip 这一篇覆盖 `[server]` 这一组
监听地址、端口、工作线程数、临时目录——决定服务"对外露在哪、临时文件落在哪"。
大多数部署只需要确认两件事：`host` 是不是 `0.0.0.0`、临时目录是不是在容量充足的盘上。
:::

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0
temp_dir = ".tmp"
upload_temp_dir = ".uploads"
```

如果 `data/config.toml` 是自动生成的，运行时实际会解析成 `data/.tmp` 和 `data/.uploads`。

## 什么时候需要改

- **容器/Docker 部署** —— `host` 改成 `0.0.0.0`，否则容器外打不进来
- **端口被占用** —— 改 `port`
- **临时目录所在盘容量小** —— 把 `temp_dir` 和 `upload_temp_dir` 挪到大盘
- **不确定线程数** —— 保持 `workers = 0` 让它按 CPU 自动决定

## 选项一览

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `host` | `"127.0.0.1"` | 监听地址；容器部署改成 `0.0.0.0` |
| `port` | `3000` | HTTP 监听端口 |
| `workers` | `0` | 工作线程数；`0` = 按 CPU 自动 |
| `temp_dir` | `".tmp"` | 服务端通用临时文件目录 |
| `upload_temp_dir` | `".uploads"` | 分片上传 / 上传恢复用的临时目录 |

## 临时目录会用在哪

`temp_dir` 和 `upload_temp_dir` 直接影响本地磁盘占用，主要消耗在：

- 大文件分片上传
- 上传恢复（断点续传）
- 本地存储的临时拼装
- 少数需要服务端临时处理的上传路径

::: tip 经常上传大文件就挪一下
默认会落到 `data/.tmp` 和 `data/.uploads`。如果你预计大量大文件上传，把这两个目录绑到容量更充足的本地盘。
:::

## 常见写法

### 本机测试

```toml
[server]
host = "127.0.0.1"
port = 3000
workers = 0
temp_dir = "data/.tmp"
upload_temp_dir = "data/.uploads"
```

### Docker / 容器

```toml
[server]
host = "0.0.0.0"
port = 3000
workers = 0
temp_dir = "/data/.tmp"
upload_temp_dir = "/data/.uploads"
```

## 几条经验

- 大多数部署不需要手调 `workers`
- 长期部署，临时目录写绝对路径
- 前面已经有反向代理时，应用本身继续监听内部端口即可，不要直接暴露到公网

## 对应环境变量

```bash
ASTER__SERVER__HOST=0.0.0.0
ASTER__SERVER__PORT=3000
ASTER__SERVER__TEMP_DIR=/data/.tmp
ASTER__SERVER__UPLOAD_TEMP_DIR=/data/.uploads
```
