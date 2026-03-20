# systemd 部署

## 安装二进制

```bash
sudo cp aster_drive /usr/local/bin/
sudo chmod +x /usr/local/bin/aster_drive
```

## 创建用户和目录

```bash
sudo useradd -r -s /usr/sbin/nologin asterdrive
sudo mkdir -p /etc/asterdrive /var/lib/asterdrive
sudo chown asterdrive:asterdrive /var/lib/asterdrive
```

## 配置文件

```bash
sudo cp config.toml /etc/asterdrive/config.toml
```

确保数据库路径和数据目录指向 `/var/lib/asterdrive`：

```toml
[server]
host = "127.0.0.1"

[database]
url = "sqlite:///var/lib/asterdrive/asterdrive.db?mode=rwc"
```

## Service 文件

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

[Install]
WantedBy=multi-user.target
```

## 启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now asterdrive
sudo systemctl status asterdrive
```

## 查看日志

```bash
journalctl -u asterdrive -f
```
