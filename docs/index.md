---
layout: home

hero:
  name: AsterDrive
  text: 自托管云存储系统
  tagline: Rust + React 构建，单二进制部署，覆盖文件管理、上传、分享、WebDAV、版本历史与回收站
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 架构概览
      link: /architecture
    - theme: alt
      text: API 文档
      link: /api/

features:
  - title: 单二进制部署
    details: 前端打包产物通过 rust-embed 内嵌到后端，生产环境只需一个可执行文件或一个镜像
  - title: 多数据库支持
    details: SQLite、MySQL、PostgreSQL 统一走 SeaORM，启动时自动执行迁移
  - title: 可插拔存储
    details: 通过存储策略在本地文件系统与 S3 兼容对象存储之间切换，并支持用户级和文件夹级覆盖
  - title: 上传协商
    details: 同时支持 `direct`、`chunked`、`presigned` 三种上传模式，前端已经接入断点续传与 S3 预签名直传
  - title: 分享与公开访问
    details: 文件和文件夹都可分享，支持密码、过期时间、下载次数限制，以及公开访问页 `/s/:token`；文件夹分享当前支持根目录浏览和子文件下载
  - title: WebDAV 集成
    details: 独立 WebDAV 账号、目录级访问范围、数据库锁与属性存储，并补了最小 DeltaV 版本历史查询能力
  - title: 生命周期管理
    details: 回收站、历史版本、缩略图、资源锁、后台清理任务全部内建，管理员可在线调整关键运行时参数
---

## 从哪开始看

- 想先把服务跑起来：看 [快速开始](/guide/getting-started)
- 想了解部署和配置：看 [部署概览](/deployment/) 与 [配置概览](/config/)
- 想看用户能做什么：看 [用户手册](/guide/user-guide)
- 想按功能查接口：看 [API 概览](/api/)
