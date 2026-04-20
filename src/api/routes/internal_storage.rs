//! 内部对象存储协议路由：`internal_storage`。

use crate::api::response::ApiResponse;
use crate::errors::{AsterError, Result};
use crate::runtime::FollowerAppState;
use crate::services::master_binding_service;
use crate::storage::driver::{BlobMetadata, StorageDriver};
use crate::storage::remote_protocol::{
    RemoteBindingSyncRequest, RemoteStorageCapabilities, RemoteStorageListResponse,
};
use actix_web::{HttpRequest, HttpResponse, web};
use futures::StreamExt;
use serde::Deserialize;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

pub fn routes() -> actix_web::Scope {
    web::scope("/internal/storage")
        .route("/capabilities", web::get().to(get_capabilities))
        .route("/binding", web::put().to(sync_binding))
        .route("/objects", web::get().to(list_objects))
        .route("/objects/{tail:.*}", web::put().to(put_object))
        .route("/objects/{tail:.*}", web::get().to(get_object))
        .route("/objects/{tail:.*}", web::head().to(head_object))
        .route("/objects/{tail:.*}", web::delete().to(delete_object))
}

#[derive(Debug, Deserialize, Default)]
struct ObjectQuery {
    offset: Option<u64>,
    length: Option<u64>,
    prefix: Option<String>,
}

async fn metadata_or_not_found(
    driver: &dyn StorageDriver,
    storage_path: &str,
) -> Result<BlobMetadata> {
    match driver.metadata(storage_path).await {
        Ok(metadata) => Ok(metadata),
        Err(error) => {
            if !driver.exists(storage_path).await.unwrap_or(true) {
                Err(AsterError::record_not_found(format!(
                    "storage object '{storage_path}' not found"
                )))
            } else {
                Err(error)
            }
        }
    }
}

async fn get_capabilities(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
) -> Result<HttpResponse> {
    master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(RemoteStorageCapabilities::default())))
}

async fn sync_binding(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    body: web::Json<RemoteBindingSyncRequest>,
) -> Result<HttpResponse> {
    let binding =
        master_binding_service::authorize_binding_sync_request(state.get_ref(), &req).await?;
    master_binding_service::sync_from_primary(
        state.get_ref(),
        &binding.access_key,
        master_binding_service::SyncMasterBindingInput {
            name: body.name.clone(),
            namespace: body.namespace.clone(),
            is_enabled: body.is_enabled,
        },
    )
    .await?;
    Ok(HttpResponse::Ok().json(ApiResponse::<()>::ok_empty()))
}

async fn list_objects(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    query: web::Query<ObjectQuery>,
) -> Result<HttpResponse> {
    let ctx = master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    let driver = state.driver_registry.get_driver(&ctx.ingress_policy)?;
    let list_driver = driver
        .as_list()
        .ok_or_else(|| AsterError::storage_driver_error("ingress policy does not support list"))?;

    let prefix = query
        .prefix
        .as_deref()
        .map(|value| master_binding_service::provider_storage_path(&ctx.binding, value));
    let root_prefix = format!("{}/", ctx.binding.namespace.trim_matches('/'));
    let items = list_driver
        .list_paths(prefix.as_deref())
        .await?
        .into_iter()
        .filter_map(|path| {
            path.strip_prefix(&root_prefix)
                .or_else(|| (path == ctx.binding.namespace).then_some(""))
                .map(str::to_string)
        })
        .collect();

    Ok(HttpResponse::Ok().json(ApiResponse::ok(RemoteStorageListResponse { items })))
}

async fn put_object(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    path: web::Path<String>,
    mut payload: web::Payload,
) -> Result<HttpResponse> {
    let ctx = master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    let storage_path =
        master_binding_service::provider_storage_path(&ctx.binding, &path.into_inner());
    let content_length = req
        .headers()
        .get(actix_web::http::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok())
        .ok_or_else(|| AsterError::validation_error("content-length header is required"))?;
    if content_length < 0 {
        return Err(AsterError::validation_error(
            "content-length must be non-negative",
        ));
    }

    let driver = state.driver_registry.get_driver(&ctx.ingress_policy)?;
    let stream_driver = driver.as_stream_upload().ok_or_else(|| {
        AsterError::storage_driver_error("ingress policy does not support stream upload")
    })?;
    let temp_path = std::env::temp_dir().join(format!(
        "aster-remote-upload-{}-{}",
        std::process::id(),
        uuid::Uuid::new_v4()
    ));
    let mut temp_file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| AsterError::storage_driver_error(format!("create temp upload file: {e}")))?;
    while let Some(chunk) = payload.next().await {
        let chunk =
            chunk.map_err(|e| AsterError::validation_error(format!("read upload payload: {e}")))?;
        temp_file.write_all(&chunk).await.map_err(|e| {
            AsterError::storage_driver_error(format!("write temp upload file: {e}"))
        })?;
    }
    temp_file
        .flush()
        .await
        .map_err(|e| AsterError::storage_driver_error(format!("flush temp upload file: {e}")))?;
    drop(temp_file);

    let temp_path_string = temp_path.to_string_lossy().into_owned();
    let upload_result = stream_driver
        .put_file(&storage_path, &temp_path_string)
        .await;
    crate::utils::cleanup_temp_file(&temp_path_string).await;
    upload_result?;
    Ok(HttpResponse::Ok().json(ApiResponse::<()>::ok_empty()))
}

async fn get_object(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<ObjectQuery>,
) -> Result<HttpResponse> {
    let ctx = master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    let storage_path =
        master_binding_service::provider_storage_path(&ctx.binding, &path.into_inner());
    let driver = state.driver_registry.get_driver(&ctx.ingress_policy)?;
    let metadata = metadata_or_not_found(driver.as_ref(), &storage_path).await?;
    let stream = match (query.offset, query.length) {
        (Some(offset), length) => driver.get_range(&storage_path, offset, length).await?,
        (None, Some(length)) => driver.get_range(&storage_path, 0, Some(length)).await?,
        (None, None) => driver.get_stream(&storage_path).await?,
    };
    let body = ReaderStream::with_capacity(stream, 64 * 1024);

    Ok(HttpResponse::Ok()
        .insert_header((
            actix_web::http::header::CONTENT_TYPE,
            metadata
                .content_type
                .unwrap_or_else(|| "application/octet-stream".to_string()),
        ))
        .insert_header((
            actix_web::http::header::CONTENT_LENGTH,
            metadata.size.to_string(),
        ))
        .streaming(body))
}

async fn head_object(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let ctx = master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    let storage_path =
        master_binding_service::provider_storage_path(&ctx.binding, &path.into_inner());
    let driver = state.driver_registry.get_driver(&ctx.ingress_policy)?;
    let metadata = metadata_or_not_found(driver.as_ref(), &storage_path).await?;

    let mut response = HttpResponse::Ok();
    response.insert_header((
        actix_web::http::header::CONTENT_LENGTH,
        metadata.size.to_string(),
    ));
    if let Some(content_type) = metadata.content_type {
        response.insert_header((actix_web::http::header::CONTENT_TYPE, content_type));
    }
    Ok(response.finish())
}

async fn delete_object(
    state: web::Data<FollowerAppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let ctx = master_binding_service::authorize_internal_request(state.get_ref(), &req).await?;
    let storage_path =
        master_binding_service::provider_storage_path(&ctx.binding, &path.into_inner());
    let driver = state.driver_registry.get_driver(&ctx.ingress_policy)?;
    driver.delete(&storage_path).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::<()>::ok_empty()))
}
