# Docker 部署

Docker 适合 NAS、单机和小团队部署。最简单的思路是把数据库和默认上传目录都放到 `/data`，这样持久化最省心。

## 最简启动命令

```bash
docker run -d \
  --name asterdrive \
  -p 3000:3000 \
  -e ASTER__SERVER__HOST=0.0.0.0 \
  -e ASTER__DATABASE__URL="sqlite:///data/asterdrive.db?mode=rwc" \
  -v asterdrive-data:/data \
  ghcr.io/apts-1547/asterdrive:latest
```

如果你只想先试运行，这个命令就够了。它会让：

- 数据库位于 `/data/asterdrive.db`
- 默认本地上传目录位于 `/data/uploads`

这时配置文件默认位于容器里的 `/config.toml`。如果不挂载它，容器重建后这份文件不会保留。

## 推荐的长期部署方式

如果你准备长期使用，建议把配置文件也一起挂载进去：

```bash
docker run -d \
  --name asterdrive \
  -p 3000:3000 \
  -e ASTER__SERVER__HOST=0.0.0.0 \
  -e ASTER__DATABASE__URL="sqlite:///data/asterdrive.db?mode=rwc" \
  -v asterdrive-data:/data \
  -v $(pwd)/config.toml:/config.toml:ro \
  ghcr.io/apts-1547/asterdrive:latest
```

如果你是本地 HTTP 测试，请先在 `config.toml` 里确认：

```toml
[auth]
cookie_secure = false
```

正式通过 HTTPS 对外提供服务后，再改回 `true`。

## Compose 示例

```yaml
services:
  asterdrive:
    image: ghcr.io/apts-1547/asterdrive:latest
    ports:
      - "3000:3000"
    environment:
      ASTER__SERVER__HOST: 0.0.0.0
      ASTER__DATABASE__URL: sqlite:///data/asterdrive.db?mode=rwc
    volumes:
      - asterdrive-data:/data
      - ./config.toml:/config.toml:ro
    restart: unless-stopped

volumes:
  asterdrive-data:
```

## 配置文件怎么准备

常见做法有两种：

- 在容器外先准备好 `config.toml`，再只读挂载进去
- 或先用临时容器启动一次，让它生成默认配置，再按自己的环境回填

第一次部署时，最值得先确认的是这几项：

- `auth.jwt_secret` 是否已经固定
- 如果暂时是本地 HTTP 测试，`auth.cookie_secure` 是否已改成 `false`
- WebDAV 路径和上传大小是否符合预期

## 从源码构建镜像

```bash
docker build -t asterdrive .
```

## 查看运行状态

```bash
docker logs -f asterdrive
```

启动后建议至少确认：

1. 打开 `http://你的主机:3000`
2. 创建第一个管理员账号
3. 上传一个测试文件
4. 检查 `/health` 和 `/health/ready`
5. 如果要用 WebDAV，再做一次客户端真实连接测试
