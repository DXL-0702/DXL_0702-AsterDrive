use crate::api::response::ApiResponse;
use crate::errors::Result;
use crate::runtime::AppState;
use crate::services::auth_service;
use actix_governor::{Governor, GovernorConfigBuilder};
use actix_web::{HttpResponse, web};
use serde::{Deserialize, Serialize};

pub fn routes() -> actix_web::Scope {
    let login_limiter = GovernorConfigBuilder::default()
        .seconds_per_request(1)
        .burst_size(5)
        .finish()
        .unwrap();

    let register_limiter = GovernorConfigBuilder::default()
        .seconds_per_request(1)
        .burst_size(3)
        .finish()
        .unwrap();

    web::scope("/auth")
        .service(
            web::resource("/register")
                .wrap(Governor::new(&register_limiter))
                .route(web::post().to(register)),
        )
        .service(
            web::resource("/login")
                .wrap(Governor::new(&login_limiter))
                .route(web::post().to(login)),
        )
        .route("/refresh", web::post().to(refresh))
}

#[derive(Deserialize)]
struct RegisterReq {
    username: String,
    email: String,
    password: String,
}

#[derive(Serialize)]
struct TokenResp {
    access_token: String,
    refresh_token: String,
}

async fn register(
    state: web::Data<AppState>,
    body: web::Json<RegisterReq>,
) -> Result<HttpResponse> {
    let user = auth_service::register(
        &state.db,
        &body.username,
        &body.email,
        &body.password,
        &state.config.auth.jwt_secret,
    )
    .await?;
    Ok(HttpResponse::Created().json(ApiResponse::ok(user)))
}

async fn login(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> Result<HttpResponse> {
    let username = body["username"].as_str().unwrap_or_default();
    let password = body["password"].as_str().unwrap_or_default();
    let tokens = auth_service::login(&state.db, username, password, &state.config.auth).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(TokenResp {
        access_token: tokens.0,
        refresh_token: tokens.1,
    })))
}

async fn refresh(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> Result<HttpResponse> {
    let token = body["refresh_token"].as_str().unwrap_or_default();
    let access = auth_service::refresh_token(token, &state.config.auth)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(
        serde_json::json!({ "access_token": access }),
    )))
}
