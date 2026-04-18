//! 集成测试：`middleware`。

#[macro_use]
mod common;

use actix_web::{body::to_bytes, http::header, test};
use aster_drive::api::{
    middleware::security_headers::{
        REFERRER_POLICY_VALUE, X_CONTENT_TYPE_OPTIONS_VALUE, X_FRAME_OPTIONS_VALUE,
    },
    routes::frontend::FRONTEND_CSP,
};
use serde_json::Value;

#[actix_web::test]
async fn test_jwt_auth_missing_token_returns_api_error() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let req = test::TestRequest::get().uri("/api/v1/folders").to_request();
    let err = test::try_call_service(&app, req).await.unwrap_err();
    let resp = err.error_response();
    assert_eq!(resp.status(), 401);

    let body = to_bytes(resp.into_body()).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(body["code"], 2000);
    assert_eq!(body["msg"], "missing token");
    assert!(body["data"].is_null());
}

#[actix_web::test]
async fn test_jwt_auth_invalid_token_returns_api_error() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let req = test::TestRequest::get()
        .uri("/api/v1/folders")
        .insert_header(("Authorization", "Bearer fake.token.here"))
        .to_request();
    let err = test::try_call_service(&app, req).await.unwrap_err();
    let resp = err.error_response();
    assert_eq!(resp.status(), 401);

    let body = to_bytes(resp.into_body()).await.unwrap();
    let body: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(body["code"], 2002);
    assert_eq!(body["msg"], "invalid token");
    assert!(body["data"].is_null());
}

#[actix_web::test]
async fn test_global_security_headers_are_applied() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let req = test::TestRequest::get().uri("/health").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    assert_eq!(
        resp.headers()
            .get("X-Frame-Options")
            .and_then(|value| value.to_str().ok()),
        Some(X_FRAME_OPTIONS_VALUE)
    );
    assert_eq!(
        resp.headers()
            .get("Referrer-Policy")
            .and_then(|value| value.to_str().ok()),
        Some(REFERRER_POLICY_VALUE)
    );
    assert_eq!(
        resp.headers()
            .get("X-Content-Type-Options")
            .and_then(|value| value.to_str().ok()),
        Some(X_CONTENT_TYPE_OPTIONS_VALUE)
    );
    assert!(
        !resp
            .headers()
            .contains_key(header::STRICT_TRANSPORT_SECURITY)
    );
}

#[actix_web::test]
async fn test_frontend_index_sets_csp_header_and_meta() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let req = test::TestRequest::get().uri("/").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), 200);
    assert_eq!(
        resp.headers()
            .get("Content-Security-Policy")
            .and_then(|value| value.to_str().ok()),
        Some(FRONTEND_CSP)
    );

    let body = to_bytes(resp.into_body()).await.unwrap();
    let html = String::from_utf8(body.to_vec()).unwrap();
    let escaped_csp = FRONTEND_CSP.replace('\'', "&#39;");
    assert!(
        html.contains(&format!(
            "<meta http-equiv=\"Content-Security-Policy\" content=\"{escaped_csp}\" />"
        )),
        "expected index.html to include CSP meta tag"
    );
}
