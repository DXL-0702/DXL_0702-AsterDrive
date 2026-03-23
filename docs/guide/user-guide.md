# 用户手册

这一页只讲普通用户最常用、而且当前已经稳定可用的能力。

## Web 界面能做什么

日常使用基本都可以直接在 Web 界面完成：

- 上传、下载、预览文件
- 重命名、复制、移动、删除文件和文件夹
- 网格 / 列表切换、面包屑导航、内联搜索
- 多选、批量操作、拖拽移动

普通上传只负责创建新文件，不会覆盖同目录已有同名文件；实际上传模式由当前存储策略自动决定，服务端可能使用 `direct`、`chunked` 或 `presigned`。

如果资源处于锁定状态，重命名、移动、删除和覆盖写入都会被拒绝，直到资源被解锁。

## 文件夹管理

文件夹是独立资源，不只是路径前缀。

你可以：

- 在根目录或子目录下创建文件夹
- 打开文件夹查看直属子文件夹和文件
- 重命名、移动、复制、删除文件夹

当前要记住的限制：

- 公开文件夹分享只展示分享根目录内容
- 还不能在公开分享页继续进入子文件夹浏览
- 文件夹复制会复用底层 Blob，不会重新写一份物理内容

## 文件版本历史

版本历史是以文件为单位保存的，只有“覆盖当前文件内容”时才会产生。

常见来源：

- 浏览器内文本编辑
- REST `PUT /api/v1/files/{id}/content`
- WebDAV 覆盖写入

你可以：

- 查看文件的历史版本列表
- 恢复某个版本为当前版本
- 删除不需要的旧版本

当前语义：

- 恢复版本不会额外生成一条“回滚快照”
- 被恢复的那条历史记录会消失，因为它已经变成当前版本
- 每个文件最多保留多少版本，由 `max_versions_per_file` 决定

## 回收站

回收站是普通删除的缓冲层。

- 删除文件或文件夹时，资源会先进入回收站
- 恢复时会尽量回到原位置
- 如果原父目录已经不存在，资源会恢复到根目录
- 你可以永久删除单个条目，也可以清空整个回收站
- 系统还会按 `trash_retention_days` 自动清理过期条目

## 分享与公开访问

AsterDrive 支持文件分享和文件夹分享。

创建分享时可以设置：

- 分享文件或文件夹
- 可选密码
- 过期时间
- 下载次数限制

同一个资源同一时间只能存在一个活跃分享；如果要新链接，要先删旧的，或者等旧分享过期。

当前公开访问边界：

- 文件分享支持公开页、下载和预览
- 文件夹分享支持展示分享根目录内容
- 根目录中展示出来的文件可以直接下载
- 仍不支持继续进入子文件夹浏览

## 文件锁定与解锁

AsterDrive 支持显式锁定文件和文件夹。

- 锁可以阻止并发重命名、移动、删除和覆盖写入
- WebDAV 客户端的 `LOCK` / `UNLOCK` 也走同一套锁系统
- 锁卡住时，管理员可以强制释放

实际效果：

- 被锁定的文件不能被其他用户重命名、移动或删除
- 被锁定的文件夹不能被修改结构
- 覆盖文件内容时，只有无锁状态或锁持有者本人才能写入

## 在线编辑

内置编辑器当前只适合文本文件编辑，不是协作编辑器。

### 支持的文件类型

当前文本编辑主要面向：

- `text/*`
- `application/json`
- `application/xml`

### 保存行为

- 读取当前内容时会拿到 `ETag`
- 保存时会携带 `If-Match`
- 服务端会在写入前检查锁状态
- 保存成功后会自动进入版本历史

当前限制：

- 只支持纯文本编辑
- 没有多人实时协作
- 没有自动合并冲突

## WebDAV 接入

默认 WebDAV 路径是 `/webdav/`。

典型地址：

```text
https://drive.example.com/webdav/
```

如果管理员修改了 `[webdav].prefix`，实际路径也会一起变化。

### cadaver

```bash
cadaver https://drive.example.com/webdav/
```

典型会话：

```bash
cadaver https://drive.example.com/webdav/
dav:/webdav/> ls
dav:/webdav/> put ./notes.txt
dav:/webdav/> get report.pdf
dav:/webdav/> quit
```

### macOS Finder

1. 打开 Finder。
2. 选择 `前往` -> `连接服务器...`。
3. 输入 `https://drive.example.com/webdav/`。
4. 使用 WebDAV 用户名和密码登录。

### Windows 映射网络驱动器

1. 确认 Windows `WebClient` 服务可用。
2. 打开资源管理器，选择 `此电脑` -> `映射网络驱动器`。
3. 输入 `https://drive.example.com/webdav/`。
4. 勾选使用其他凭据连接。
5. 使用 WebDAV 用户名和密码登录。

生产环境建议使用 HTTPS。Windows WebDAV 在 TLS 场景下通常比纯 HTTP 更稳定。

### Rclone

创建远程：

```bash
rclone config create asterdrive webdav \
  url https://drive.example.com/webdav/ \
  vendor other \
  user alice-laptop \
  pass "$(rclone obscure 'strong-password')"
```

使用远程：

```bash
rclone ls asterdrive:
rclone copy ./local-folder asterdrive:/backup
```

## WebDAV 专用账号

WebDAV 专用账号和普通网页登录账号是分开的，更适合桌面客户端、同步工具和自动化脚本。

好处很直接：

- 可以给每台设备单独分配用户名和密码
- 可以单独停用某个设备，不影响网页登录
- 可以把某个账号限制到单一根目录

还要记住两点：

- `password` 为空时，服务端会自动生成随机密码，而且只会返回一次
- 被停用的 WebDAV 账号无法继续认证，直到重新启用

## 继续阅读

- [文件编辑](/guide/editing)
- [分享与公开访问](/guide/sharing)
- [WebDAV API 与协议能力](/api/webdav)
