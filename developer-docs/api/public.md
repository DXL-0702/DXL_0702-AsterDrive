# 公共接口

这组路径都相对于 `/api/v1`，且不需要认证。

目前公开给匿名页面启动用的接口只有一条：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/public/branding` | 读取登录页、公开页和匿名入口需要的品牌配置 |

## `GET /public/branding`

返回仍然使用统一 JSON 包装：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "title": "AsterDrive",
    "description": "Self-hosted cloud storage",
    "favicon_url": "/favicon.svg",
    "wordmark_dark_url": "/static/asterdrive/asterdrive-dark.svg",
    "wordmark_light_url": "/static/asterdrive/asterdrive-light.svg",
    "site_url": "https://drive.example.com",
    "allow_user_registration": true
  }
}
```

字段含义：

- `title` / `description`：公开页面展示文案
- `favicon_url`：站点图标
- `wordmark_dark_url` / `wordmark_light_url`：亮暗背景下使用的品牌字标
- `site_url`：当前对外公开站点地址；未配置时可能为 `null`
- `allow_user_registration`：匿名页是否应展示注册入口

当前前端登录页和公开入口会先拉这条接口，再决定匿名态 UI，而不是把这些值硬编码进前端构建产物。
