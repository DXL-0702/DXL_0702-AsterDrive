# 反向代理

生产环境建议在 AsterDrive 前面放一个反向代理处理 TLS 和缓存。

## Caddy

```caddyfile
drive.example.com {
    reverse_proxy localhost:3000
}
```

Caddy 会自动申请和续签 HTTPS 证书。

## Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name drive.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    client_max_body_size 0;  # 不限制上传大小

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

::: warning
`client_max_body_size 0` 取消 Nginx 的上传大小限制。文件大小限制由存储策略的 `max_file_size` 控制。
:::
