# 运行时配置

运行时配置存放在数据库 `system_config` 表，而不是 `config.toml`。

它们的特点是：

- 由管理员通过 API 在线修改
- 值统一以字符串形式存储
- 适合放“无需重启即可调整”的策略项

## 当前有效的配置项

| Key | 默认值 | 作用 |
|------|--------|------|
| `webdav_enabled` | `"true"` | 控制 WebDAV 是否接受请求。关闭后 `/webdav` 返回 `503` |
| `trash_retention_days` | `"7"` | 回收站保留天数，后台任务每小时清理一次 |
| `max_versions_per_file` | `"10"` | 单文件最多保留多少历史版本，超出后自动删除最旧版本 |

## 管理方式

### 读取全部运行时配置

```bash
curl -X GET http://localhost:3000/api/v1/admin/config \
  -b cookies.txt
```

### 设置单个 key

```bash
curl -X PUT http://localhost:3000/api/v1/admin/config/trash_retention_days \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"value":"14"}'
```

### 删除单个 key

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/config/max_versions_per_file \
  -b cookies.txt
```

删除后，对应逻辑会回退到代码内置默认值。

## 当前未写入“生效配置”的项

`src/config/schema.rs` 的注释里提到过 `webdav_max_upload_size`，但按当前实现它并没有真正参与请求处理。

如果你需要限制 WebDAV 上传，请优先使用：

- 静态配置 `webdav.payload_limit`
- 存储策略中的 `max_file_size`
