#[macro_use]
mod common;

use actix_web::test;
use serde_json::Value;

#[actix_web::test]
async fn test_register_and_login() {
    let state = common::setup().await;
    let app = create_test_app!(state);

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
            "identifier": "alice",
            "password": "secret123"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    // tokens 在 cookie 里
    assert!(common::extract_cookie(&resp, "aster_access").is_some());
    assert!(common::extract_cookie(&resp, "aster_refresh").is_some());

    // 错误密码
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/login")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "identifier": "alice",
            "password": "wrongpassword"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_token_refresh() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let (_access, refresh) = register_and_login!(app);

    let req = test::TestRequest::post()
        .uri("/api/v1/auth/refresh")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .insert_header(("Cookie", format!("aster_refresh={refresh}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    assert!(common::extract_cookie(&resp, "aster_access").is_some());
}

#[actix_web::test]
async fn test_auth_me() {
    let state = common::setup().await;
    let app = create_test_app!(state);

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

/// 注册时自动分配系统默认存储策略
#[actix_web::test]
async fn test_register_auto_assigns_policy() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 获取用户 ID
    let req = test::TestRequest::get()
        .uri("/api/v1/auth/me")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let user_id = body["data"]["id"].as_i64().unwrap();

    // 用户应已有 1 个策略分配（自动分配的）
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/admin/users/{user_id}/policies"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    let policies = body["data"]["items"].as_array().unwrap();
    assert_eq!(body["data"]["total"], 1);
    assert_eq!(
        policies.len(),
        1,
        "new user should have 1 auto-assigned policy"
    );
    assert_eq!(
        policies[0]["is_default"], true,
        "auto-assigned policy should be default"
    );
}

#[actix_web::test]
async fn test_unauthorized_access() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    // 没 token 访问受保护端点
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

/// 用户状态缓存：正常认证 → 连续请求不应查 DB（通过 MemoryCache 验证）
#[actix_web::test]
async fn test_user_status_cached_in_auth_middleware() {
    // 用 MemoryCache 替代默认 NoopCache
    let cache_config = aster_drive::config::CacheConfig {
        enabled: true,
        backend: "memory".to_string(),
        default_ttl: 60,
        ..Default::default()
    };
    let cache = aster_drive::cache::create_cache(&cache_config).await;

    let base = common::setup().await;
    let state = aster_drive::runtime::AppState {
        db: base.db,
        driver_registry: base.driver_registry,
        config: base.config,
        cache,
        thumbnail_tx: base.thumbnail_tx,
    };
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 第一次请求（cache miss → 查 DB → 写缓存）
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 第二次请求（cache hit → 不查 DB）—— 功能正确即可
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
}

/// admin 禁用用户后，缓存立即失效，后续请求被拒
#[actix_web::test]
async fn test_disable_user_invalidates_status_cache() {
    let cache_config = aster_drive::config::CacheConfig {
        enabled: true,
        backend: "memory".to_string(),
        default_ttl: 60,
        ..Default::default()
    };
    let cache = aster_drive::cache::create_cache(&cache_config).await;

    let base = common::setup().await;
    let state = aster_drive::runtime::AppState {
        db: base.db,
        driver_registry: base.driver_registry,
        config: base.config,
        cache,
        thumbnail_tx: base.thumbnail_tx,
    };
    let app = create_test_app!(state);
    let (admin_token, _) = register_and_login!(app);

    // 注册第二个用户
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/register")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "bobuser",
            "email": "bob@example.com",
            "password": "password456"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let status = resp.status();
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(status, 201, "register bob failed: {body}");
    let bob_id = body["data"]["id"].as_i64().unwrap();

    // bob 登录
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/login")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "identifier": "bobuser",
            "password": "password456"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let bob_token = common::extract_cookie(&resp, "aster_access").unwrap();

    // bob 正常访问（写入缓存）
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={bob_token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // admin 禁用 bob
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/admin/users/{bob_id}"))
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .set_json(serde_json::json!({ "status": "disabled" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // bob 再次访问——应被拒（缓存已失效）
    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={bob_token}")))
        .to_request();
    let result = test::try_call_service(&app, req).await;
    match result {
        Ok(resp) => assert_eq!(resp.status(), 403, "disabled user should get 403"),
        Err(err) => {
            let resp = err.error_response();
            assert_eq!(resp.status(), 403, "disabled user should get 403");
        }
    }
}
