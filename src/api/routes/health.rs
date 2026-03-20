use crate::api::response::ApiResponse;
use crate::runtime::AppState;
use actix_web::{HttpResponse, web};

pub fn routes() -> actix_web::Scope {
    web::scope("/health")
        .route("", web::get().to(health))
        .route("", web::head().to(health))
        .route("/ready", web::get().to(ready))
        .route("/ready", web::head().to(ready))
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "status": "ok" })))
}

async fn ready(state: web::Data<AppState>) -> HttpResponse {
    match state.db.ping().await {
        Ok(_) => {
            HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({ "status": "ready" })))
        }
        Err(e) => HttpResponse::ServiceUnavailable()
            .json(ApiResponse::<()>::error("D001", &e.to_string())),
    }
}
