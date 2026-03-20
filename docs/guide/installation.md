# 安装

## 环境要求

- Rust 1.91.1+
- bun（前端构建）

## 从源码构建

```bash
git clone https://github.com/AptS-1547/AsterDrive.git
cd AsterDrive

# 构建前端
cd frontend-panel
bun install
bun run build
cd ..

# 构建后端
cargo build --release
```

产物在 `target/release/aster_drive`。

## Docker

```bash
docker pull ghcr.io/apts-1547/asterdrive:latest
```

## 预编译二进制

从 [GitHub Releases](https://github.com/AptS-1547/AsterDrive/releases) 下载对应平台的二进制文件。

支持平台：Linux (x86_64, ARM64)、macOS (x86_64, ARM64)、Windows (x86_64)。
