# 上传模式

AsterDrive 当前不是固定一种上传方式，而是由前后端协商选择最合适的模式。

对应入口：

```text
POST /api/v1/files/upload/init
```

前端会根据返回结果自动切换到 `direct`、`chunked` 或 `presigned`，普通用户不需要手工选择。

## 三种模式分别是什么

| 模式 | 适合场景 | 数据流向 |
| --- | --- | --- |
| `direct` | 小文件、普通表单上传 | 浏览器 -> AsterDrive |
| `chunked` | 大文件、需要断点续传 | 浏览器 -> AsterDrive（分片） |
| `presigned` | S3 兼容对象存储直传 | 浏览器 -> 对象存储，AsterDrive 只做协商与完成 |

## `direct`

`direct` 是最简单的上传模式。

服务端通常会在这些情况下返回它：

- 当前策略 `chunk_size == 0`
- 或文件大小没有超过当前策略的分片阈值

特点：

- 前端走普通 `multipart/form-data`
- 上传流量直接经过 AsterDrive
- 同目录同名文件不会被覆盖，而是报冲突

## `chunked`

`chunked` 用于较大的文件。

服务端通常会在这些情况下返回它：

- 文件大小超过当前策略的 `chunk_size`
- 且当前不是可用的 `presigned` 场景

特点：

- 前端会拿到 `upload_id`、`chunk_size`、`total_chunks`
- 分片逐个上传，失败时可重试
- 前端已实现取消、重试和断点续传相关逻辑
- 上传流量仍然经过 AsterDrive 与反向代理

这也是部署时最需要注意代理超时和 body 限制的模式之一。

## `presigned`

`presigned` 只会在 S3 兼容对象存储场景出现。

必须同时满足这些条件：

- 当前策略驱动是 `s3`
- 策略 `options` 中启用了 `{"presigned_upload": true}`
- 文件大小不超过单次 `PUT` 的 5 GiB

特点：

- 前端先拿到一个 `presigned_url`
- 浏览器直接把文件 `PUT` 到对象存储
- 上传完成后，再调用 `/complete`
- AsterDrive 在完成阶段仍会做哈希、去重、落库和最终对象整理

## 对部署的影响

### 反向代理

- `direct` / `chunked`：上传流量经过代理层和 AsterDrive
- `presigned`：主要上传流量不经过代理层，代理只处理协商和完成阶段

### 对象存储 CORS

如果你启用了 `presigned_upload`，必须在对象存储侧配置浏览器 `PUT` 所需的 CORS。

否则前端会在直传阶段直接失败，即使 AsterDrive 本身配置正确也没用。

### 存储策略

上传模式不是全局开关，而是当前生效存储策略的一部分行为：

```text
文件夹策略 -> 用户默认策略 -> 系统默认策略
```

所以同一个系统里，不同目录和不同用户可能命中不同上传模式。

## 前端当前体验

当前前端已经提供：

- 上传队列
- 进度显示
- 取消上传
- 失败重试
- `chunked` 分片并发
- `presigned` 直传阶段与服务端处理阶段的分段进度

入口主要在文件浏览器上传面板，而不是单独的上传页。

## 常见排查点

上传异常时，优先检查：

1. 当前命中的存储策略是什么
2. 该策略的 `chunk_size` 与 `options.presigned_upload` 是否符合预期
3. 代理层是否限制了上传体积或超时时间
4. 如果是 `presigned`，对象存储是否已经正确配置 CORS
5. 用户配额与策略 `max_file_size` 是否触发限制

## 继续阅读

- [存储策略](/config/storage)
- [文件 API](/api/files)
- [部署概览](/deployment/)
- [反向代理部署](/deployment/proxy)
