use actix_web::{App, test, web};
use aster_drive::api;
use aster_drive::runtime::AppState;
use serde_json::Value;

/// 构建一个干净的测试 AppState（内存 SQLite）
async fn setup() -> AppState {
    // 用内存数据库，每次测试隔离
    let db_cfg = aster_drive::config::DatabaseConfig {
        url: "sqlite::memory:".to_string(),
        pool_size: 1,
        retry_count: 0,
    };
    let db = aster_drive::db::connect(&db_cfg).await.unwrap();

    // 跑迁移
    use migration::{Migrator, MigratorTrait};
    Migrator::up(&db, None).await.unwrap();

    // 每个测试用独立临时目录避免并行竞争
    let test_dir = format!("/tmp/asterdrive-test-{}", uuid::Uuid::new_v4());
    std::fs::create_dir_all(&test_dir).unwrap();

    // 创建默认本地存储策略
    use chrono::Utc;
    use sea_orm::Set;
    let now = Utc::now();
    let _ = aster_drive::db::repository::policy_repo::create(
        &db,
        aster_drive::entities::storage_policy::ActiveModel {
            name: Set("Test Local".to_string()),
            driver_type: Set(aster_drive::types::DriverType::Local),
            endpoint: Set(String::new()),
            bucket: Set(String::new()),
            access_key: Set(String::new()),
            secret_key: Set(String::new()),
            base_path: Set(test_dir),
            max_file_size: Set(0),
            allowed_types: Set("[]".to_string()),
            options: Set("{}".to_string()),
            is_default: Set(true),
            chunk_size: Set(5_242_880),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    // 测试用 NoopCache
    let cache_config = aster_drive::config::CacheConfig {
        enabled: false,
        ..Default::default()
    };
    let cache = aster_drive::cache::create_cache(&cache_config).await;

    let config = std::sync::Arc::new(aster_drive::config::Config {
        auth: aster_drive::config::AuthConfig {
            jwt_secret: "test-secret-key-for-integration-tests".to_string(),
            access_token_ttl_secs: 900,
            refresh_token_ttl_secs: 604800,
        },
        ..Default::default()
    });

    // 初始化全局 config（WebDAV file.rs 内部调 get_config() 需要）
    // OnceLock 只设置一次，后续调用忽略
    let _ = aster_drive::config::set_config_for_test(config.clone());

    AppState {
        db,
        driver_registry: std::sync::Arc::new(aster_drive::storage::DriverRegistry::new()),
        config,
        cache,
    }
}

/// 从 Set-Cookie header 提取指定 cookie 的值
fn extract_cookie(resp: &actix_web::dev::ServiceResponse, name: &str) -> Option<String> {
    resp.response()
        .cookies()
        .find(|c| c.name() == name)
        .map(|c| c.value().to_string())
}

/// 注册 + 登录的宏，返回 (access_cookie, refresh_cookie)
macro_rules! register_and_login {
    ($app:expr) => {{
        // 注册
        let req = test::TestRequest::post()
            .uri("/api/v1/auth/register")
            .peer_addr("127.0.0.1:12345".parse().unwrap())
            .set_json(serde_json::json!({
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123"
            }))
            .to_request();
        let resp: actix_web::dev::ServiceResponse = test::call_service(&$app, req).await;
        assert_eq!(resp.status(), 201, "register should return 201");

        // 登录
        let req = test::TestRequest::post()
            .uri("/api/v1/auth/login")
            .peer_addr("127.0.0.1:12345".parse().unwrap())
            .set_json(serde_json::json!({
                "username": "testuser",
                "password": "password123"
            }))
            .to_request();
        let resp: actix_web::dev::ServiceResponse = test::call_service(&$app, req).await;
        assert_eq!(resp.status(), 200, "login should return 200");
        let access = extract_cookie(&resp, "aster_access").expect("access cookie missing");
        let refresh = extract_cookie(&resp, "aster_refresh").expect("refresh cookie missing");
        (access, refresh)
    }};
}

// ─── Tests ───────────────────────────────────────────────

#[actix_web::test]
async fn test_health() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["status"], "ok");
}

#[actix_web::test]
async fn test_health_ready() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let req = test::TestRequest::get().uri("/health/ready").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["status"], "ready");
}

#[actix_web::test]
async fn test_register_and_login() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    // 注册
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/register")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "alice",
            "email": "alice@example.com",
            "password": "secret123"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["code"], 0);
    assert_eq!(body["data"]["username"], "alice");
    // password_hash 不应该暴露
    assert!(body["data"]["password_hash"].is_null());

    // 重复注册应失败
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/register")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "alice",
            "email": "alice2@example.com",
            "password": "secret123"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400);

    // 登录
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/login")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "alice",
            "password": "secret123"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    // tokens 在 cookie 里
    assert!(extract_cookie(&resp, "aster_access").is_some());
    assert!(extract_cookie(&resp, "aster_refresh").is_some());

    // 错误密码
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/login")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "alice",
            "password": "wrongpassword"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_token_refresh() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (_access, refresh) = register_and_login!(app);

    let req = test::TestRequest::post()
        .uri("/api/v1/auth/refresh")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .insert_header(("Cookie", format!("aster_refresh={refresh}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    assert!(extract_cookie(&resp, "aster_access").is_some());
}

#[actix_web::test]
async fn test_folders_crud() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);

    // 列出根目录（应为空）
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["folders"], Value::Array(vec![]));
    assert_eq!(body["data"]["files"], Value::Array(vec![]));

    // 创建文件夹
    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "Documents" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    let folder_id = body["data"]["id"].as_i64().unwrap();
    assert_eq!(body["data"]["name"], "Documents");

    // 列出根目录（应有 1 个文件夹）
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["folders"].as_array().unwrap().len(), 1);

    // 重命名文件夹
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "My Docs" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["name"], "My Docs");

    // 删除文件夹
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn test_file_upload_download_delete() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);

    // 上传文件（multipart）
    let boundary = "----TestBoundary123";
    let file_content = b"Hello AsterDrive!";
    let body = format!(
        "------TestBoundary123\r\n\
         Content-Disposition: form-data; name=\"file\"; filename=\"hello.txt\"\r\n\
         Content-Type: text/plain\r\n\r\n\
         {}\r\n\
         ------TestBoundary123--\r\n",
        std::str::from_utf8(file_content).unwrap()
    );

    let req = test::TestRequest::post()
        .uri("/api/v1/files/upload")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={boundary}"),
        ))
        .set_payload(body)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "upload should return 201 Created");
    let upload_body: Value = test::read_body_json(resp).await;
    assert_eq!(upload_body["code"], 0);
    let file_id = upload_body["data"]["id"].as_i64().unwrap();
    assert_eq!(upload_body["data"]["name"], "hello.txt");
    assert_eq!(upload_body["data"]["mime_type"], "text/plain");

    // 获取文件信息
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["name"], "hello.txt");

    // 下载文件
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}/download"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let download_body = test::read_body(resp).await;
    // multipart 可能带有前导空格，trim 一下
    let content = String::from_utf8_lossy(&download_body);
    assert!(
        content.contains("Hello AsterDrive!"),
        "downloaded content should match: got '{content}'"
    );

    // 列出根目录应该有这个文件
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 1);

    // 删除文件
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 再查应该 404
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
async fn test_unauthorized_access() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    // 没 token 访问受保护端点 — 中间件返回 Error，用 try_call_service
    let req = test::TestRequest::get().uri("/api/v1/folders").to_request();
    let result = test::try_call_service(&app, req).await;
    match result {
        Ok(resp) => assert_eq!(resp.status(), 401),
        Err(err) => {
            let resp = err.error_response();
            assert_eq!(resp.status(), 401);
        }
    }

    // 假 token
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Authorization", "Bearer fake.token.here"))
        .to_request();
    let result = test::try_call_service(&app, req).await;
    match result {
        Ok(resp) => assert_eq!(resp.status(), 401),
        Err(err) => {
            let resp = err.error_response();
            assert_eq!(resp.status(), 401);
        }
    }
}

/// 上传测试文件的宏，返回 file_id
macro_rules! upload_test_file {
    ($app:expr, $token:expr) => {{
        let boundary = "----TestBoundary123";
        let payload = format!(
            "------TestBoundary123\r\n\
             Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
             Content-Type: text/plain\r\n\r\n\
             test content\r\n\
             ------TestBoundary123--\r\n"
        );
        let req = test::TestRequest::post()
            .uri("/api/v1/files/upload")
            .insert_header(("Cookie", format!("aster_access={}", $token)))
            .insert_header((
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            ))
            .set_payload(payload)
            .to_request();
        let resp: actix_web::dev::ServiceResponse = test::call_service(&$app, req).await;
        assert_eq!(resp.status(), 201, "upload should return 201");
        let body: Value = test::read_body_json(resp).await;
        body["data"]["id"].as_i64().unwrap()
    }};
}

// ─── New Tests ────────────────────────────────────────────────────

#[actix_web::test]
async fn test_auth_me() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);

    let req = test::TestRequest::get()
        .uri("/api/v1/auth/me")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["username"], "testuser");
    assert!(body["data"]["password_hash"].is_null());
}

#[actix_web::test]
async fn test_file_lock_unlock() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 锁定文件
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/files/{file_id}/lock"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "locked": true }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["is_locked"], true);

    // 删除应失败 (423 Locked → 但 service 返回 403 Forbidden mapping)
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 403 || resp.status() == 423);

    // 重命名应失败
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "renamed.txt" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 403 || resp.status() == 423);

    // 解锁
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/files/{file_id}/lock"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "locked": false }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 解锁后删除成功
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn test_folder_lock_unlock() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);

    // 创建文件夹
    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "Locked Folder" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    let folder_id = body["data"]["id"].as_i64().unwrap();

    // 锁定
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/folders/{folder_id}/lock"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "locked": true }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 删除失败
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 403 || resp.status() == 423);

    // 重命名失败
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "Nope" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 403 || resp.status() == 423);

    // 解锁 → 删除成功
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/folders/{folder_id}/lock"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "locked": false }))
        .to_request();
    test::call_service(&app, req).await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn test_shares_crud() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 创建分享
    let req = test::TestRequest::post()
        .uri("/api/v1/shares")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "file_id": file_id }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    let share_token = body["data"]["token"].as_str().unwrap().to_string();
    let share_id = body["data"]["id"].as_i64().unwrap();

    // 列出分享
    let req = test::TestRequest::get()
        .uri("/api/v1/shares")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"].as_array().unwrap().len(), 1);

    // 公开访问分享信息
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/s/{share_token}"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["name"], "test.txt");

    // 公开下载
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/s/{share_token}/download"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 删除分享
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/shares/{share_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 分享不再可访问
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/s/{share_token}"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 404 || resp.status() == 410);
}

#[actix_web::test]
async fn test_trash_restore_purge() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 软删除
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 列出回收站
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 1);

    // 恢复
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/trash/file/{file_id}/restore"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 文件可访问
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 再次软删除 → purge 永久删除
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    test::call_service(&app, req).await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/trash/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 回收站为空
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);
}

#[actix_web::test]
async fn test_entity_properties() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 设置属性
    let req = test::TestRequest::put()
        .uri(&format!("/api/v1/properties/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({
            "namespace": "aster:",
            "name": "color",
            "value": "red"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["name"], "color");
    assert_eq!(body["data"]["value"], "red");

    // 列出属性
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/properties/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"].as_array().unwrap().len(), 1);

    // 删除属性
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/properties/file/{file_id}/aster:/color"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 列出为空
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/properties/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"].as_array().unwrap().len(), 0);

    // DAV: 命名空间被拒绝
    let req = test::TestRequest::put()
        .uri(&format!("/api/v1/properties/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({
            "namespace": "DAV:",
            "name": "getcontenttype",
            "value": "text/plain"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status() == 403 || resp.status() == 423);
}

#[actix_web::test]
async fn test_admin_locks() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    // 第一个用户自动成为 admin
    let (token, _) = register_and_login!(app);

    // 列出锁（应为空）
    let req = test::TestRequest::get()
        .uri("/api/v1/admin/locks")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"].as_array().unwrap().len(), 0);

    // 清理过期锁
    let req = test::TestRequest::delete()
        .uri("/api/v1/admin/locks/expired")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["removed"], 0);
}

#[actix_web::test]
async fn test_file_rename_move() {
    let state = setup().await;
    let db = state.db.clone();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .configure(move |cfg| api::configure(cfg, &db)),
    )
    .await;

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 创建文件夹
    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "Target" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let folder_id = body["data"]["id"].as_i64().unwrap();

    // 重命名文件
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "renamed.txt" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["name"], "renamed.txt");

    // 移动到文件夹
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "folder_id": folder_id }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 确认在新文件夹中
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/folders/{folder_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 1);
    assert_eq!(body["data"]["files"][0]["name"], "renamed.txt");

    // 根目录应该没有文件了
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);
}

// ─── WebDAV Tests ─────────────────────────────────────────────────

/// 构建带 WebDAV 路由的测试 App（普通测试不注册 WebDAV，因为全局 config 未初始化）
macro_rules! setup_with_webdav {
    () => {{
        let state = setup().await;
        let db1 = state.db.clone();
        let db2 = state.db.clone();
        let webdav_config = aster_drive::config::WebDavConfig::default();
        let app = test::init_service(App::new().app_data(web::Data::new(state)).configure(
            move |cfg| {
                // WebDAV 必须在 api::configure 之前注册
                // 因为 api::configure 内部注册了 frontend SPA fallback 兜底
                aster_drive::webdav::configure(cfg, &webdav_config, &db2);
                api::configure(cfg, &db1);
            },
        ))
        .await;
        app
    }};
}

#[actix_web::test]
async fn test_webdav_propfind_root() {
    let app = setup_with_webdav!();

    let (token, _) = register_and_login!(app);

    // PROPFIND 根目录 (Depth: 0)
    let req = test::TestRequest::with_uri("/webdav/")
        .method(actix_web::http::Method::from_bytes(b"PROPFIND").unwrap())
        .insert_header(("Authorization", format!("Bearer {token}")))
        .insert_header(("Depth", "0"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    // 207 Multi-Status
    assert_eq!(resp.status(), 207, "PROPFIND root should return 207");
}

#[actix_web::test]
async fn test_webdav_mkcol_and_list() {
    let app = setup_with_webdav!();

    let (token, _) = register_and_login!(app);
    let auth = format!("Bearer {token}");

    // MKCOL 创建目录
    let req = test::TestRequest::with_uri("/webdav/testdir/")
        .method(actix_web::http::Method::from_bytes(b"MKCOL").unwrap())
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "MKCOL should return 201");

    // PROPFIND 根目录 (Depth: 1) — 应包含 testdir
    let req = test::TestRequest::with_uri("/webdav/")
        .method(actix_web::http::Method::from_bytes(b"PROPFIND").unwrap())
        .insert_header(("Authorization", auth.clone()))
        .insert_header(("Depth", "1"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 207);
    let body = test::read_body(resp).await;
    let xml = String::from_utf8_lossy(&body);
    assert!(
        xml.contains("testdir"),
        "PROPFIND should list testdir: {xml}"
    );
}

#[actix_web::test]
async fn test_webdav_put_get_delete() {
    let app = setup_with_webdav!();

    let (token, _) = register_and_login!(app);
    let auth = format!("Bearer {token}");

    // PUT 上传文件
    let req = test::TestRequest::put()
        .uri("/webdav/hello.txt")
        .insert_header(("Authorization", auth.clone()))
        .insert_header(("Content-Type", "text/plain"))
        .set_payload("WebDAV test content")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(
        resp.status() == 201 || resp.status() == 204,
        "PUT should return 201 or 204, got {}",
        resp.status()
    );

    // GET 下载文件
    let req = test::TestRequest::get()
        .uri("/webdav/hello.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET should return 200");
    let body = test::read_body(resp).await;
    assert!(
        String::from_utf8_lossy(&body).contains("WebDAV test content"),
        "GET content mismatch"
    );

    // DELETE 删除文件
    let req = test::TestRequest::delete()
        .uri("/webdav/hello.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(
        resp.status() == 200 || resp.status() == 204,
        "DELETE should return 200 or 204, got {}",
        resp.status()
    );

    // GET 应该 404
    let req = test::TestRequest::get()
        .uri("/webdav/hello.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

#[actix_web::test]
async fn test_webdav_copy_move() {
    let app = setup_with_webdav!();

    let (token, _) = register_and_login!(app);
    let auth = format!("Bearer {token}");

    // PUT 创建源文件
    let req = test::TestRequest::put()
        .uri("/webdav/source.txt")
        .insert_header(("Authorization", auth.clone()))
        .set_payload("copy me")
        .to_request();
    test::call_service(&app, req).await;

    // COPY 复制文件
    let req = test::TestRequest::with_uri("/webdav/source.txt")
        .method(actix_web::http::Method::from_bytes(b"COPY").unwrap())
        .insert_header(("Authorization", auth.clone()))
        .insert_header(("Destination", "/webdav/copied.txt"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(
        resp.status() == 201 || resp.status() == 204,
        "COPY should return 201/204, got {}",
        resp.status()
    );

    // 验证副本存在
    let req = test::TestRequest::get()
        .uri("/webdav/copied.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // MOVE 移动文件
    let req = test::TestRequest::with_uri("/webdav/source.txt")
        .method(actix_web::http::Method::from_bytes(b"MOVE").unwrap())
        .insert_header(("Authorization", auth.clone()))
        .insert_header(("Destination", "/webdav/moved.txt"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(
        resp.status() == 201 || resp.status() == 204,
        "MOVE should return 201/204, got {}",
        resp.status()
    );

    // 原文件不存在
    let req = test::TestRequest::get()
        .uri("/webdav/source.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);

    // 新位置存在
    let req = test::TestRequest::get()
        .uri("/webdav/moved.txt")
        .insert_header(("Authorization", auth.clone()))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

#[actix_web::test]
async fn test_webdav_options() {
    let app = setup_with_webdav!();

    let (token, _) = register_and_login!(app);

    // OPTIONS 应返回 DAV header
    let req = test::TestRequest::with_uri("/webdav/")
        .method(actix_web::http::Method::OPTIONS)
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let dav_header = resp
        .headers()
        .get("DAV")
        .map(|v| v.to_str().unwrap_or(""))
        .unwrap_or("");
    assert!(
        dav_header.contains("1"),
        "DAV header should contain '1', got: '{dav_header}'"
    );
}
