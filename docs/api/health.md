# 健康检查 API

不需要认证。

## GET /health

存活探针（Liveness）。只要进程运行就返回 200。

**响应：**

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "version": "0.0.0",
    "build_time": "2026-03-21T00:00:00Z"
  }
}
```

支持 HEAD 方法。

## GET /health/ready

就绪探针（Readiness）。检查数据库连接是否正常。

- 数据库正常：`200`
- 数据库不可达：`503`

支持 HEAD 方法。

## Kubernetes 配置示例

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
```
