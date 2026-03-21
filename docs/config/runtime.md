# 运行时配置

运行时配置存放在数据库 `system_config` 表，而不是 `config.toml`。

## 架构设计

### 两类配置

| | 系统配置 | 自定义配置 |
|---|---|---|
| `source` | `"system"` | `"custom"` |
| 来源 | `ALL_CONFIGS` 静态定义 | Admin 手动创建 |
| 启动时 | 自动初始化默认值 | 不自动创建 |
| 可删除 | 否（API 返回 403） | 是 |
| 用途 | 后端业务逻辑读取 | 自定义前端/插件配置 |

### 配置定义（单一数据源）

所有系统配置在 `src/config/definitions.rs` 的 `ALL_CONFIGS` 数组中集中定义：

```rust
pub struct ConfigDef {
    pub key: &'static str,         // 数据库 unique key
    pub value_type: &'static str,  // "string" | "number" | "boolean"
    pub default_fn: fn() -> String,// 默认值生成函数
    pub requires_restart: bool,    // 修改后是否需重启生效
    pub is_sensitive: bool,        // 是否敏感值（前端脱敏）
    pub category: &'static str,   // 分类（前端分组）
    pub description: &'static str, // 描述
}
```

### 启动时初始化

`runtime/startup.rs` 中，数据库迁移完成后自动调用 `config_repo::ensure_defaults()`：

- 遍历 `ALL_CONFIGS`，对每项执行 `INSERT ... ON CONFLICT(key) DO NOTHING`
- 已存在的配置值不会被覆盖（用户修改过的值保持不变）
- 新增的配置项自动写入默认值

## 系统配置项

| Key | 类型 | 默认值 | 分类 | 作用 |
|-----|------|--------|------|------|
| `webdav_enabled` | boolean | `"true"` | webdav | 控制 WebDAV 是否接受请求 |
| `max_versions_per_file` | number | `"10"` | storage | 单文件最多保留多少历史版本 |
| `trash_retention_days` | number | `"7"` | storage | 回收站保留天数 |
| `default_storage_quota` | number | `"0"` | storage | 新用户默认配额（字节，0=不限制） |

### 生效时机

- **`webdav_enabled`** — 实时生效，关闭后 `/webdav` 返回 503
- **`max_versions_per_file`** — 文件被覆盖产生新版本时读取
- **`trash_retention_days`** — 后台任务每小时读取并清理
- **`default_storage_quota`** — 新用户注册时读取，不影响已有用户

## 自定义配置

自定义配置用于自定义前端或插件存储自己的设置。

### 创建自定义配置

```bash
curl -X PUT http://localhost:3000/api/v1/admin/config/my-frontend.theme \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"value":"dark"}'
```

### 命名约定

自定义配置的 key 建议使用 `{namespace}.{name}` 格式，避免与系统配置或其他自定义前端冲突：

```
my-frontend.theme          # 主题设置
my-frontend.locale         # 语言设置
my-frontend.sidebar_width  # 侧边栏宽度
custom-app.api_endpoint    # 自定义应用的 API 地址
```

### 读取配置（前端）

自定义前端可以通过 Admin API 读取配置：

```typescript
// 获取所有配置
const configs = await api.get("/admin/config");

// 筛选自己的命名空间
const myConfigs = configs.filter(c => c.key.startsWith("my-frontend."));
```

### 与系统配置的区别

- 自定义配置 **可以删除**，系统配置不可以
- 自定义配置不会在启动时自动创建
- 自定义配置的 `value_type` 默认为 `"string"`，创建时可指定

## 管理 API

### 列出所有配置

```bash
curl -X GET http://localhost:3000/api/v1/admin/config \
  -b cookies.txt
```

### 设置配置值

```bash
curl -X PUT http://localhost:3000/api/v1/admin/config/{key} \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"value":"14"}'
```

### 删除配置

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/config/{key} \
  -b cookies.txt
```

系统配置（`source="system"`）不允许删除，返回 403。

## 数据库表结构

```sql
CREATE TABLE system_config (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    key         VARCHAR(128) NOT NULL UNIQUE,
    value       TEXT NOT NULL,
    value_type  VARCHAR(32) NOT NULL DEFAULT 'string',
    requires_restart BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMP NOT NULL,
    updated_by  BIGINT NULL
);
```
