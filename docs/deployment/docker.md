# Docker 部署

## 快速开始

```bash
docker run -d \
  --name asterdrive \
  -p 3000:3000 \
  -v asterdrive-data:/data \
  ghcr.io/apts-1547/asterdrive:latest
```

## Docker Compose

```yaml
services:
  asterdrive:
    image: ghcr.io/apts-1547/asterdrive:latest
    ports:
      - "3000:3000"
    volumes:
      - asterdrive-data:/app/data
      - ./config.toml:/app/config.toml:ro
    environment:
      - ASTER__SERVER__HOST=0.0.0.0
    restart: unless-stopped

volumes:
  asterdrive-data:
```

```bash
docker compose up -d
```

## 自定义配置

先生成一份默认配置：

```bash
docker run --rm ghcr.io/apts-1547/asterdrive:latest --print-config > config.toml
```

编辑 `config.toml` 后挂载进容器。

## 镜像标签

| 标签 | 说明 |
|------|------|
| `latest` | 最新构建 |
| `stable` | 最新正式版 |
| `edge` | 最新预发布版 |
| `vX.Y.Z` | 指定版本 |

## 从源码构建

```bash
docker build -t asterdrive .
```

镜像基于 `scratch`，最终产物为静态链接的 musl 二进制。
