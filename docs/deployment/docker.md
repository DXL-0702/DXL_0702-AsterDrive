# Docker 部署

当前仓库的 `Dockerfile` 是三阶段构建：

1. 构建前端
2. 构建静态链接 Rust 二进制
3. 打包到 `scratch` 镜像

## 直接运行镜像

最小示例：

```bash
docker run -d \
  --name asterdrive \
  -p 3000:3000 \
  -e ASTER__SERVER__HOST=0.0.0.0 \
  -v asterdrive-data:/data \
  ghcr.io/apts-1547/asterdrive:latest
```

## 当前镜像的路径约定

镜像里只有一个入口：

```text
/aster_drive
```

并且当前 `Dockerfile` 没有设置 `WORKDIR`，所以请按代码当前行为理解路径：

- 配置文件默认读取 `/config.toml`
- 默认本地数据目录实际落到 `/data`

如果你要挂载配置文件，推荐这样做：

```bash
-v $(pwd)/config.toml:/config.toml:ro
```

## Compose 示例

```yaml
services:
  asterdrive:
    image: ghcr.io/apts-1547/asterdrive:latest
    ports:
      - "3000:3000"
    environment:
      ASTER__SERVER__HOST: 0.0.0.0
    volumes:
      - asterdrive-data:/data
      - ./config.toml:/config.toml:ro
    restart: unless-stopped

volumes:
  asterdrive-data:
```

## 配置文件生成方式

当前程序没有 `--print-config` 之类的专用导出参数。

推荐两种做法：

- 直接参考仓库根目录的 `config.example.toml`
- 在本地直接运行一次二进制，让它自动生成 `config.toml`

## 从源码构建镜像

```bash
docker build -t asterdrive .
```

也可以显式指定 feature：

```bash
docker build --build-arg CARGO_FEATURES="server" -t asterdrive .
```

## Swagger 提示

发布镜像是 release 构建，因此默认不会暴露 `/swagger-ui`。
