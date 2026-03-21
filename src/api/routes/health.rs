use crate::api::response::ApiResponse;
use crate::runtime::AppState;
use actix_web::{HttpResponse, web};

pub fn routes() -> actix_web::Scope {
    web::scope("/health")
        .route("", web::get().to(health))
        .route("", web::head().to(health))
        .route("/ready", web::get().to(ready))
        .route("/ready", web::head().to(ready))
    // .route("/memory", web::get().to(memory)) // TODO: 上 Prometheus 后用 metrics 替代
}

#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    operation_id = "health",
    responses(
        (status = 200, description = "Service is healthy", body = inline(ApiResponse<crate::api::response::HealthResponse>)),
    ),
)]
pub async fn health() -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "build_time": compile_time(),
    })))
}

#[utoipa::path(
    get,
    path = "/health/ready",
    tag = "health",
    operation_id = "ready",
    responses(
        (status = 200, description = "Service is ready", body = inline(ApiResponse<crate::api::response::HealthResponse>)),
        (status = 503, description = "Service unavailable"),
    ),
)]
pub async fn ready(state: web::Data<AppState>) -> HttpResponse {
    match state.db.ping().await {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
            "status": "ready",
            "version": env!("CARGO_PKG_VERSION"),
            "build_time": compile_time(),
        }))),
        Err(e) => HttpResponse::ServiceUnavailable().json(ApiResponse::<()>::error(
            crate::api::error_code::ErrorCode::DatabaseError,
            &e.to_string(),
        )),
    }
}

pub async fn memory() -> HttpResponse {
    let (allocated, peak) = crate::alloc::stats();
    HttpResponse::Ok().json(ApiResponse::ok(serde_json::json!({
        "heap_allocated_mb": format!("{allocated:.2}"),
        "heap_peak_mb": format!("{peak:.2}"),
    })))
}

fn compile_time() -> &'static str {
    option_env!("ASTER_BUILD_TIME").unwrap_or("unknown")
}
