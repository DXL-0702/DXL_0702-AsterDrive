#[macro_use]
mod common;

use actix_web::test;
use serde_json::Value;

// ── 策略删除保护：有 blob 引用则拒绝 ───────────────────────

#[actix_web::test]
async fn test_policy_delete_with_blobs_rejected() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 上传文件（会在默认策略创建 blob）
    let _file_id = upload_test_file!(app, token);

    // 获取策略 ID
    let req = test::TestRequest::get()
        .uri("/api/v1/admin/policies")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let policy_id = body["data"][0]["id"].as_i64().unwrap();

    // 尝试删除策略 → 应被拒绝（有 blob 引用）
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/admin/policies/{policy_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        400,
        "should reject policy delete with blobs, got {}",
        resp.status()
    );
}

// ── 用户强制删除：级联清理所有数据 ─────────────────────────

#[actix_web::test]
async fn test_force_delete_user() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    // 注册第一个用户（admin，id=1）
    let (admin_token, _) = register_and_login!(app);

    // 注册第二个用户
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/register")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "victim",
            "email": "victim@example.com",
            "password": "password123"
        }))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);

    // 登录第二个用户
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/login")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "victim",
            "password": "password123"
        }))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    let victim_token =
        common::extract_cookie(&resp, "aster_access").expect("access cookie missing");

    // 用第二个用户上传文件
    let _file_id = upload_test_file!(app, victim_token);

    // 获取第二个用户 ID
    let req = test::TestRequest::get()
        .uri("/api/v1/admin/users")
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let users = body["data"].as_array().unwrap();
    let victim_id = users.iter().find(|u| u["username"] == "victim").unwrap()["id"]
        .as_i64()
        .unwrap();

    // admin 强制删除第二个用户
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/admin/users/{victim_id}"))
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        200,
        "force delete should succeed, got {}",
        resp.status()
    );

    // 确认用户不存在了
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/admin/users/{victim_id}"))
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}

// ── 不能删除初始管理员 id=1 ────────────────────────────────

#[actix_web::test]
async fn test_cannot_delete_initial_admin() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (admin_token, _) = register_and_login!(app);

    // 尝试删除 id=1
    let req = test::TestRequest::delete()
        .uri("/api/v1/admin/users/1")
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        400,
        "should reject deleting initial admin, got {}",
        resp.status()
    );
}

// ── 不能删除 admin 角色用户 ────────────────────────────────

#[actix_web::test]
async fn test_cannot_delete_admin_role() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (admin_token, _) = register_and_login!(app);

    // 注册第二个用户
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/register")
        .peer_addr("127.0.0.1:12345".parse().unwrap())
        .set_json(serde_json::json!({
            "username": "admin2",
            "email": "admin2@example.com",
            "password": "password123"
        }))
        .to_request();
    let _: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;

    // 获取 admin2 的 ID
    let req = test::TestRequest::get()
        .uri("/api/v1/admin/users")
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let users = body["data"].as_array().unwrap();
    let admin2_id = users.iter().find(|u| u["username"] == "admin2").unwrap()["id"]
        .as_i64()
        .unwrap();

    // 提升为 admin
    let req = test::TestRequest::patch()
        .uri(&format!("/api/v1/admin/users/{admin2_id}"))
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .set_json(serde_json::json!({"role": "admin"}))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 尝试删除 admin2 → 应被拒绝
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/admin/users/{admin2_id}"))
        .insert_header(("Cookie", format!("aster_access={admin_token}")))
        .to_request();
    let resp: actix_web::dev::ServiceResponse = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        400,
        "should reject deleting admin role user, got {}",
        resp.status()
    );
}
