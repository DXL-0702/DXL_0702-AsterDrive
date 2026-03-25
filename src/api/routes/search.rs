use crate::api::middleware::auth::JwtAuth;
use crate::api::middleware::rate_limit;
use crate::api::response::ApiResponse;
use crate::config::RateLimitConfig;
use crate::errors::Result;
use crate::runtime::AppState;
use crate::services::{
    auth_service::Claims,
    search_service::{self, SearchParams, SearchResults},
};
use actix_governor::Governor;
use actix_web::middleware::Condition;
use actix_web::{HttpResponse, web};

pub fn routes(rl: &RateLimitConfig) -> impl actix_web::dev::HttpServiceFactory + use<> {
    let limiter = rate_limit::build_governor(&rl.api);

    web::scope("/search")
        .wrap(JwtAuth)
        .wrap(Condition::new(rl.enabled, Governor::new(&limiter)))
        .route("", web::get().to(search))
}

#[utoipa::path(
    get,
    path = "/api/v1/search",
    tag = "search",
    operation_id = "search",
    params(SearchParams),
    responses(
        (status = 200, description = "Search results", body = inline(ApiResponse<SearchResults>)),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
)]
pub async fn search(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
    query: web::Query<SearchParams>,
) -> Result<HttpResponse> {
    let results = search_service::search(&state, claims.user_id, &query).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(results)))
}
