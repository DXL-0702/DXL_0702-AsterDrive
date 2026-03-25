# 安装部署

AsterDrive 适合做成一个单服务应用来部署。网页、公开分享页和 WebDAV 都由同一个服务提供，所以大多数用户只需要把这一套服务跑起来就够了。

## 先决定用哪种方式

| 方式 | 适合谁 |
| --- | --- |
| Docker | NAS、家用服务器、小团队、已经有容器环境 |
| systemd | 云主机、物理机、希望长期稳定运行 |
| 直接运行二进制或 `cargo run` | 本地试用、临时验证 |

## 部署前先确认四件事

### 1. 配置文件、数据库和上传目录放在哪

如果你用默认配置，AsterDrive 会自动创建：

- `config.toml`
- SQLite 数据库
- 默认本地上传目录 `data/uploads`

这些路径都和启动目录有关。部署前先决定要把数据放在哪个目录或卷里，再启动服务。

### 2. 你是否会通过 HTTPS 对外访问

正式上线时，建议通过 HTTPS 提供服务，并保持：

```toml
[auth]
cookie_secure = true
```

如果你只是本机 HTTP 测试，可以暂时改成：

```toml
[auth]
cookie_secure = false
```

### 3. 你是否要启用 WebDAV

如果你要给 Finder、Windows 资源管理器、rclone 或同步工具使用，请提前一起规划：

- WebDAV 地址
- 反向代理
- 上传大小限制

### 4. 你是否要使用 S3 或 MinIO

如果你准备用对象存储，请提前准备：

- Endpoint
- Bucket
- Access Key / Secret Key
- 浏览器直传所需的 CORS 设置

## 方式一：Docker 部署

最常见的启动方式如下：

```bash
docker run -d \
  --name asterdrive \
  -p 3000:3000 \
  -e ASTER__SERVER__HOST=0.0.0.0 \
  -e ASTER__DATABASE__URL="sqlite:///data/asterdrive.db?mode=rwc" \
  -v asterdrive-data:/data \
  ghcr.io/apts-1547/asterdrive:latest
```

这个方式适合第一次试用。容器里最重要的持久化目录是 `/data`：

- 数据库可以放到 `/data/asterdrive.db`
- 默认本地上传目录会落到 `/data/uploads`

如果你希望同时固定配置文件，再额外挂载：

```bash
-v $(pwd)/config.toml:/config.toml:ro
```

更完整的示例见 [Docker 部署](/deployment/docker)。

## 方式二：直接运行或从源码构建

```bash
git clone https://github.com/AptS-1547/AsterDrive.git
cd AsterDrive

cd frontend-panel
bun install
bun run build
cd ..

cargo build --release
./target/release/aster_drive
```

如果你只是本地快速验证，也可以直接执行：

```bash
cargo run
```

如果你准备把它做成长期服务，请继续看 [systemd 部署](/deployment/systemd)。

## 首次启动后会自动完成什么

服务第一次成功启动后，会自动完成这些动作：

- 生成 `config.toml`
- 创建默认 SQLite 数据库
- 创建默认本地上传目录 `data/uploads`
- 执行数据库迁移
- 创建默认本地存储策略 `Local Default`
- 初始化系统设置

之后在浏览器打开：

```text
http://127.0.0.1:3000
```

第一个创建的账号会自动成为管理员。

## 部署后先验证这几项

- 可以正常打开首页并登录
- 可以创建文件夹并上传文件
- 可以把文件移到回收站并恢复
- 管理后台可以打开
- `GET /health` 和 `GET /health/ready` 返回正常
- 如果你启用了 WebDAV，客户端可以成功连接

## 继续阅读

- [快速开始](/guide/getting-started)
- [部署概览](/deployment/)
- [Docker 部署](/deployment/docker)
- [systemd 部署](/deployment/systemd)
- [配置概览](/config/)
