# systemd 部署

systemd 场景下，最重要的是把 `WorkingDirectory` 设对，因为当前代码会从工作目录读取：

- `config.toml`
- 默认 SQLite 数据库
- 默认本地存储目录 `data/uploads`
- 运行时前端覆盖目录 `./frontend-panel/dist`

## 1. 安装二进制

```bash
sudo install -m 0755 target/release/aster_drive /usr/local/bin/aster_drive
```

## 2. 创建运行用户与目录

```bash
sudo useradd -r -s /usr/sbin/nologin asterdrive
sudo mkdir -p /var/lib/asterdrive
sudo chown -R asterdrive:asterdrive /var/lib/asterdrive
```

## 3. 准备配置文件

把配置文件放进工作目录：

如果你不想手写，也可以先让服务在这个工作目录里启动一次，利用自动生成逻辑产出默认 `config.toml`，再补上数据库地址、JWT 密钥和日志配置。

```bash
sudo cp config.toml /var/lib/asterdrive/config.toml
sudo chown asterdrive:asterdrive /var/lib/asterdrive/config.toml
```

如果继续使用默认 SQLite 与默认本地存储策略，工作目录下会自动出现：

- `asterdrive.db`
- `data/uploads`

## 4. Service 文件

创建 `/etc/systemd/system/asterdrive.service`：

```ini
[Unit]
Description=AsterDrive
After=network.target

[Service]
Type=simple
User=asterdrive
Group=asterdrive
WorkingDirectory=/var/lib/asterdrive
ExecStart=/usr/local/bin/aster_drive
Restart=on-failure
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

## 5. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now asterdrive
sudo systemctl status asterdrive
```

## 6. 查看日志

```bash
journalctl -u asterdrive -f
```

上线后建议先确认：

- `/health` 返回 200
- `/health/ready` 返回 200
- 首次启动日志里已完成 migration 与默认策略初始化
- 如果启用了 WebDAV，实际挂载路径与 `[webdav].prefix` 一致

## 7. 常见变体

### 把数据库放到其他位置

```ini
Environment=ASTER__DATABASE__URL=sqlite:///srv/asterdrive/asterdrive.db?mode=rwc
```

### 监听所有网卡

```ini
Environment=ASTER__SERVER__HOST=0.0.0.0
```

### 固定 JWT 密钥

```ini
Environment=ASTER__AUTH__JWT_SECRET=your-fixed-secret
```

## 8. HTTPS 与域名

systemd 只负责拉起服务。若你需要：

- HTTPS
- 公开域名
- WebDAV 客户端访问

请在前面再加一层反向代理，见 [反向代理部署](/deployment/proxy)。
