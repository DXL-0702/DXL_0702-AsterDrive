# 反向代理

生产环境通常应在 AsterDrive 前面放一个反向代理，用来处理：

- HTTPS
- 域名
- 大文件上传
- WebDAV 客户端接入

## 代理时需要保留的内容

如果你启用了 WebDAV，请确认代理层不会丢失：

- `Authorization`
- `Depth`
- `Destination`
- `Overwrite`
- `If`
- `Lock-Token`
- 各类 WebDAV 方法，例如 `PROPFIND`、`MOVE`、`COPY`、`LOCK`、`UNLOCK`

## Caddy

```txt
drive.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 默认会把大部分头和方法透传，适合先跑起来。

## Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name drive.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_buffering off;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Depth $http_depth;
        proxy_set_header Destination $http_destination;
        proxy_set_header Overwrite $http_overwrite;
        proxy_set_header If $http_if;
        proxy_set_header Lock-Token $http_lock_token;
        proxy_set_header Timeout $http_timeout;
    }
}
```

## 注意事项

### 上传大小

`client_max_body_size 0` 用于取消 Nginx 自身限制。

真正的限制仍然来自：

- 存储策略的 `max_file_size`
- WebDAV 的 `payload_limit`

### Swagger

如果你的上游服务是 release 构建，则不会有 `/swagger-ui`，这不是代理配置问题，而是当前编译行为决定的。
