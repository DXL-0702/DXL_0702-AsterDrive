use crate::api::response::ApiResponse;
use crate::runtime::AppState;
use actix_web::{HttpResponse, web};

pub fn routes() -> actix_web::Scope {
    let scope = web::scope("/health")
        .route("", web::get().to(health))
        .route("", web::head().to(health))
        .route("/ready", web::get().to(ready))
        .route("/ready", web::head().to(ready))
        .route("/memory", web::get().to(memory));

    #[cfg(feature = "metrics")]
    let scope = scope.route("/metrics", web::get().to(metrics_endpoint));

    scope
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

#[cfg(feature = "metrics")]
pub async fn metrics_endpoint() -> HttpResponse {
    let Some(metrics) = crate::metrics::get_metrics() else {
        return HttpResponse::ServiceUnavailable()
            .content_type("text/plain")
            .body("Metrics not initialized");
    };

    // 更新 uptime
    metrics.uptime_seconds.set(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0),
    );

    match metrics.export() {
        Ok(output) => HttpResponse::Ok()
            .content_type("text/plain; version=0.0.4; charset=utf-8")
            .body(output),
        Err(e) => HttpResponse::InternalServerError().body(format!("Failed to export: {e}")),
    }
}

fn compile_time() -> &'static str {
    option_env!("ASTER_BUILD_TIME").unwrap_or("unknown")
}
