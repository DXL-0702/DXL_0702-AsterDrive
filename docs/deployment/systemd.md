# systemd 部署

systemd 场景下，最重要的是把 `WorkingDirectory` 设对，因为当前代码会从工作目录读取：

- `config.toml`
- SQLite 数据库
- 默认本地数据目录 `data/uploads`

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

将配置文件放到工作目录中：

```bash
sudo cp config.toml /var/lib/asterdrive/config.toml
sudo chown asterdrive:asterdrive /var/lib/asterdrive/config.toml
```

如果你想继续使用默认 SQLite 与默认本地存储策略，工作目录下会自动出现：

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

## 7. HTTPS 与域名

systemd 只负责拉起服务。若你需要：

- HTTPS
- 公开域名
- WebDAV 客户端访问

请在前面再加一层反向代理，见 [反向代理部署](/deployment/proxy)。
