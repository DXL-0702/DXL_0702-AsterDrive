---
layout: home

hero:
  name: AsterDrive
  text: 自托管文件、团队空间与 WebDAV 服务
  tagline: 给部署者和普通用户看的手册，按当前版本实际页面、后台入口和默认行为编写
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 部署手册
      link: /guide/installation
    - theme: alt
      text: 使用手册
      link: /guide/user-guide

features:
  - title: 一个服务交付完整站点
    details: 浏览器文件管理、公开分享页、管理后台和 WebDAV 都由同一个 AsterDrive 服务提供，不需要再单独部署前端站点
  - title: 个人盘和团队空间都能写清楚
    details: 用户可以在个人空间和团队空间之间切换，文档会按当前工作空间来说明上传、分享、回收站和团队协作
  - title: 先把服务跑起来
    details: 文档优先覆盖首次部署、首次登录、上传、分享、WebDAV 连接、团队空间和后台维护这些最常见场景
  - title: 后台入口按页面来写
    details: 用户、团队、存储策略、策略组、分享、锁、系统设置、审计日志和版本信息都有对应说明
  - title: 本地盘和 S3 都能落地
    details: 默认本地存储开箱即用；如果你要接 MinIO 或其他 S3 兼容对象存储，也有对应部署和配置说明
  - title: 只写当前版本真正能看到的东西
    details: 文档已按仓库当前代码核对，尽量不保留旧入口、旧概念和开发者视角的说明
---

## 从哪里开始

- 第一次把服务跑起来：看 [快速开始](/guide/getting-started)
- 还没决定用 Docker、systemd 还是直接跑二进制：看 [部署手册](/guide/installation)
- 想知道登录后怎么上传、分享、恢复文件：看 [用户手册](/guide/user-guide)
- 想知道团队空间、成员管理和常用操作顺序：看 [常用流程](/guide/core-workflows)
- 想知道管理员日常要改什么：看 [管理后台](/guide/admin-console)
- 想改端口、数据库、登录、WebDAV、系统设置或存储路线：看 [配置说明](/config/)
