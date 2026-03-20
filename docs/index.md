---
layout: home

hero:
  name: AsterDrive
  text: 自托管云存储系统
  tagline: 基于 Rust + React 构建，单二进制部署，可插拔存储后端
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/AptS-1547/AsterDrive

features:
  - title: 单二进制部署
    details: 前端通过 rust-embed 嵌入，一个可执行文件包含全部功能
  - title: 多数据库支持
    details: SQLite（默认）、MySQL、PostgreSQL，通过 sea-orm 统一抽象
  - title: 可插拔存储
    details: 本地文件系统和 S3 兼容后端，通过存储策略灵活分配
  - title: 文件去重
    details: SHA-256 内容哈希 + 引用计数，相同文件只存一份
  - title: 安全认证
    details: JWT HttpOnly Cookie，access/refresh token 自动轮换
  - title: OpenAPI 文档
    details: utoipa 自动生成，内置 Swagger UI
---
