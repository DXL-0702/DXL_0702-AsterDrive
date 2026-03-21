# 安装

## 环境要求

按当前仓库实现，常见安装方式有两类：

- 直接使用发布镜像或预编译二进制
- 从源码构建完整前后端

源码构建所需环境：

- Rust `1.91.1+`
- `bun`，用于前端与文档构建

## 从源码构建

```bash
git clone https://github.com/AptS-1547/AsterDrive.git
cd AsterDrive

cd frontend-panel
bun install
bun run build
cd ..

cargo build --release
```

构建产物位于：

```text
target/release/aster_drive
```

## 前端未构建时的行为

后端构建阶段会检查 `frontend-panel/dist`。

- 如果存在，产物会被嵌入二进制
- 如果不存在，`build.rs` 会生成一个回退页

这意味着即使没有完整前端，服务仍可启动并提供 API，只是首页会提示先构建前端。

## Docker / OCI 镜像

仓库提供多阶段构建的 `Dockerfile`，最终镜像为 `scratch`。

```bash
docker pull ghcr.io/apts-1547/asterdrive:latest
```

镜像特点：

- 只包含静态链接后的 `aster_drive`
- 默认监听 `3000`
- 通过环境变量设置 `ASTER__SERVER__HOST=0.0.0.0`

更完整的运行方式见 [Docker 部署](/deployment/docker)。

## 文档与 OpenAPI

- VitePress 文档位于 `docs/`
- 交互式 Swagger UI 只在 debug 构建中可用
- 前端使用的静态 OpenAPI 文件通过下面命令生成：

```bash
cargo test --test generate_openapi
```
