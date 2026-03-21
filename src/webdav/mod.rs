pub mod auth;
pub mod db_lock_system;
pub mod dir_entry;
pub mod file;
pub mod fs;
pub mod metadata;
pub mod path_resolver;

use actix_web::web;
use dav_server::actix::{DavRequest, DavResponse};
use dav_server::{DavConfig, DavHandler};
use sea_orm::DatabaseConnection;

use crate::config::WebDavConfig;
use crate::db::repository::config_repo;
use crate::runtime::AppState;

/// WebDAV 共享状态（单例）
pub struct WebDavState {
    pub handler: DavHandler,
    pub prefix: String,
    pub db: DatabaseConnection,
}

/// WebDAV handler — 所有 HTTP 方法都路由到这里，由 dav-server 内部分派
pub async fn webdav_handler(
    dav_req: DavRequest,
    state: web::Data<AppState>,
    webdav: web::Data<WebDavState>,
) -> DavResponse {
    // 1. 检查运行时开关 (system_config: webdav_enabled)
    let enabled = match config_repo::find_by_key(&state.db, "webdav_enabled").await {
        Ok(Some(cfg)) => cfg.value != "false",
        _ => true, // 默认启用
    };

    if !enabled {
        return http::Response::builder()
            .status(503)
            .body(dav_server::body::Body::from("WebDAV is disabled"))
            .unwrap()
            .into();
    }

    // 2. 认证
    let auth_result = match auth::authenticate_webdav(dav_req.request.headers(), &state).await {
        Ok(r) => r,
        Err(_) => {
            return http::Response::builder()
                .status(401)
                .header("WWW-Authenticate", "Basic realm=\"AsterDrive WebDAV\"")
                .body(dav_server::body::Body::from("Unauthorized"))
                .unwrap()
                .into();
        }
    };

    // 3. 创建 per-user 文件系统（可能限制到指定文件夹）
    let dav_fs = fs::AsterDavFs::new(
        state.db.clone(),
        state.driver_registry.clone(),
        state.config.clone(),
        state.cache.clone(),
        auth_result.user_id,
        auth_result.root_folder_id,
    );

    // 4. Per-request 锁系统（需要 user_id 做 path → entity 解析）
    let lock_system = db_lock_system::DbLockSystem::new(
        webdav.db.clone(),
        auth_result.user_id,
        auth_result.root_folder_id,
    );

    // 5. 构建 per-request 配置
    let config = DavConfig::new()
        .filesystem(Box::new(dav_fs))
        .locksystem(lock_system)
        .strip_prefix(&webdav.prefix);

    // 6. 交给 dav-server 处理
    webdav
        .handler
        .handle_with(config, dav_req.request)
        .await
        .into()
}

/// 注册 WebDAV 路由（需要 db 来创建 per-request DbLockSystem）
pub fn configure(
    cfg: &mut web::ServiceConfig,
    webdav_config: &WebDavConfig,
    db: &DatabaseConnection,
) {
    let webdav_state = web::Data::new(WebDavState {
        handler: DavHandler::builder().build_handler(),
        prefix: webdav_config.prefix.clone(),
        db: db.clone(),
    });

    cfg.app_data(webdav_state).service(
        web::scope(&webdav_config.prefix)
            .app_data(web::PayloadConfig::new(webdav_config.payload_limit))
            .default_service(web::to(webdav_handler)),
    );
}
