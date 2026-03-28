---
layout: home

hero:
  name: AsterDrive
  text: 自托管文件、分享与 WebDAV 服务
  tagline: 这套文档按当前版本的实际页面和默认行为编写，直接告诉你怎么部署、怎么用、出了问题先看哪里
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
  - title: 一个服务就够
    details: 浏览器页面、公开分享页和 WebDAV 都由同一个 AsterDrive 服务提供，不需要再单独部署一个前端站点
  - title: 先能跑起来，再慢慢细化
    details: 文档优先覆盖首次部署、首次登录、上传、分享、WebDAV 连接和后台维护这些最常见场景
  - title: 普通用户能直接照着做
    details: 文件夹、上传、下载、拖拽整理、搜索、回收站、分享、预览和文本编辑都按页面入口来写
  - title: 管理员日常维护也有手册
    details: 用户、配额、存储策略、系统设置、分享、锁和审计日志都有对应说明，先照着做就能用
  - title: 支持本地盘和 S3
    details: 默认本地存储开箱即用；如果要接 MinIO 或其他 S3 兼容对象存储，也有对应部署和配置说明
  - title: 文档按当前版本对齐
    details: 首页、配置项、后台设置和用户页面都按仓库当前代码核对过，尽量只保留用户真正需要的信息
---

## 常用入口

- 第一次把服务跑起来：看 [快速开始](/guide/getting-started)
- 还没决定用 Docker、systemd 还是直接跑二进制：看 [安装部署](/guide/installation)
- 想知道登录后怎么上传、分享、恢复文件：看 [用户手册](/guide/user-guide)
- 想知道管理员日常要改什么：看 [管理后台](/guide/admin-console)
- 想改端口、数据库、登录、WebDAV 或存储方式：看 [管理员配置](/config/)
