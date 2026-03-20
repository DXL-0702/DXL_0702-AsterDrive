use crate::api::middleware::auth::JwtAuth;
use crate::api::response::ApiResponse;
use crate::errors::Result;
use crate::runtime::AppState;
use crate::services::{auth_service::Claims, folder_service};
use actix_web::{HttpResponse, web};
use serde::Deserialize;

pub fn routes() -> impl actix_web::dev::HttpServiceFactory {
    web::scope("/folders")
        .wrap(JwtAuth)
        .route("", web::get().to(list_root))
        .route("", web::post().to(create_folder))
        .route("/{id}", web::get().to(list_folder))
        .route("/{id}", web::delete().to(delete_folder))
        .route("/{id}", web::patch().to(patch_folder))
}

#[derive(Deserialize)]
struct CreateFolderReq {
    name: String,
    parent_id: Option<i64>,
}

async fn create_folder(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
    body: web::Json<CreateFolderReq>,
) -> Result<HttpResponse> {
    let folder =
        folder_service::create(&state.db, claims.user_id, &body.name, body.parent_id).await?;
    Ok(HttpResponse::Created().json(ApiResponse::ok(folder)))
}

async fn list_root(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse> {
    let contents = folder_service::list(&state.db, claims.user_id, None).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(contents)))
}

async fn list_folder(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
    path: web::Path<i64>,
) -> Result<HttpResponse> {
    let contents = folder_service::list(&state.db, claims.user_id, Some(*path)).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(contents)))
}

async fn delete_folder(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
    path: web::Path<i64>,
) -> Result<HttpResponse> {
    folder_service::delete(&state.db, *path, claims.user_id).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::<()>::ok_empty()))
}

#[derive(Deserialize)]
struct PatchFolderReq {
    name: Option<String>,
    parent_id: Option<i64>,
    policy_id: Option<i64>,
}

async fn patch_folder(
    state: web::Data<AppState>,
    claims: web::ReqData<Claims>,
    path: web::Path<i64>,
    body: web::Json<PatchFolderReq>,
) -> Result<HttpResponse> {
    let folder = folder_service::update(
        &state.db,
        *path,
        claims.user_id,
        body.name.clone(),
        body.parent_id,
        body.policy_id,
    )
    .await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(folder)))
}
