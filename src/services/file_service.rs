use actix_multipart::Multipart;
use actix_web::HttpResponse;
use chrono::Utc;
use futures::StreamExt;
use sea_orm::Set;

use crate::cache::CacheExt;
use crate::db::repository::{file_repo, policy_repo, user_repo};
use crate::entities::{file, file_blob, user_storage_policy};
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::utils::hash;

/// 上传文件
pub async fn upload(
    state: &AppState,
    user_id: i64,
    payload: &mut Multipart,
    folder_id: Option<i64>,
) -> Result<file::Model> {
    let db = &state.db;

    // 读取 multipart field — 只取 file field 的数据
    let mut filename = String::from("unnamed");
    let mut data = Vec::new();

    while let Some(field) = payload.next().await {
        let mut field = field.map_err(|e| AsterError::file_upload_failed(e.to_string()))?;
        let is_file = field
            .content_disposition()
            .and_then(|cd| cd.get_filename().map(|n| n.to_string()));

        if let Some(name) = is_file {
            filename = name;
            while let Some(chunk) = field.next().await {
                let chunk = chunk.map_err(|e| AsterError::file_upload_failed(e.to_string()))?;
                data.extend_from_slice(&chunk);
            }
        }
    }

    if data.is_empty() {
        return Err(AsterError::validation_error("empty file"));
    }

    // 确定存储策略
    let policy = resolve_policy(state, user_id, folder_id).await?;

    // 检查文件大小限制
    if policy.max_file_size > 0 && (data.len() as i64) > policy.max_file_size {
        return Err(AsterError::file_too_large(format!(
            "file size {} exceeds limit {}",
            data.len(),
            policy.max_file_size
        )));
    }

    let file_hash = hash::sha256_hex(&data);
    let size = data.len() as i64;

    // 检查用户配额
    let user = user_repo::find_by_id(db, user_id).await?;
    if user.storage_quota > 0 && user.storage_used + size > user.storage_quota {
        return Err(AsterError::storage_quota_exceeded(format!(
            "quota {}, used {}, need {}",
            user.storage_quota, user.storage_used, size
        )));
    }

    let now = Utc::now();

    // 查找是否已有相同 blob
    let blob = match file_repo::find_blob_by_hash(db, &file_hash, policy.id).await? {
        Some(existing) => {
            // 增加引用计数
            let mut active: file_blob::ActiveModel = existing.clone().into();
            active.ref_count = Set(existing.ref_count + 1);
            active.updated_at = Set(now);
            use sea_orm::ActiveModelTrait;
            active.update(db).await.map_err(AsterError::from)?
        }
        None => {
            // 写入物理文件
            let storage_path = format!("{}/{}/{}", &file_hash[..2], &file_hash[2..4], &file_hash);
            let driver = state.driver_registry.get_driver(&policy)?;
            driver.put(&storage_path, &data).await?;

            file_repo::create_blob(
                db,
                file_blob::ActiveModel {
                    hash: Set(file_hash),
                    size: Set(size),
                    policy_id: Set(policy.id),
                    storage_path: Set(storage_path),
                    ref_count: Set(1),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                },
            )
            .await?
        }
    };

    // 推测 MIME 类型
    let mime = mime_guess::from_path(&filename)
        .first_or_octet_stream()
        .to_string();

    // 检查同名文件
    if file_repo::find_by_name_in_folder(db, user_id, folder_id, &filename)
        .await?
        .is_some()
    {
        return Err(AsterError::validation_error(format!(
            "file '{}' already exists in this folder",
            filename
        )));
    }

    // 创建文件记录
    let file_model = file::ActiveModel {
        name: Set(filename),
        folder_id: Set(folder_id),
        blob_id: Set(blob.id),
        user_id: Set(user_id),
        mime_type: Set(mime),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    let created = file_repo::create(db, file_model).await?;

    // 更新用户已用空间
    user_repo::update_storage_used(db, user_id, size).await?;

    Ok(created)
}

/// 获取文件信息
pub async fn get_info(state: &AppState, id: i64, user_id: i64) -> Result<file::Model> {
    let f = file_repo::find_by_id(&state.db, id).await?;
    if f.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your file"));
    }
    Ok(f)
}

/// 下载文件
pub async fn download(state: &AppState, id: i64, user_id: i64) -> Result<HttpResponse> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, id).await?;
    if f.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your file"));
    }

    let blob = file_repo::find_blob_by_id(db, f.blob_id).await?;
    let policy = policy_repo::find_by_id(db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let data = driver.get(&blob.storage_path).await?;

    Ok(HttpResponse::Ok()
        .content_type(f.mime_type)
        .insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", f.name),
        ))
        .body(data))
}

/// 下载文件（无用户校验，用于分享链接）
pub async fn download_raw(state: &AppState, id: i64) -> Result<HttpResponse> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, id).await?;
    let blob = file_repo::find_blob_by_id(db, f.blob_id).await?;
    let policy = policy_repo::find_by_id(db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let data = driver.get(&blob.storage_path).await?;

    Ok(HttpResponse::Ok()
        .content_type(f.mime_type)
        .insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", f.name),
        ))
        .body(data))
}

/// 删除文件
pub async fn delete(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, id).await?;
    if f.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your file"));
    }

    let blob = file_repo::find_blob_by_id(db, f.blob_id).await?;
    file_repo::delete(db, id).await?;

    // 回减用户已用空间
    user_repo::update_storage_used(db, user_id, -blob.size).await?;

    // 减少引用计数，如果为 0 则删除物理文件
    if blob.ref_count <= 1 {
        // best-effort 删除缩略图
        if let Err(e) = crate::services::thumbnail_service::delete_thumbnail(state, &blob).await {
            tracing::warn!("failed to delete thumbnail for blob {}: {e}", blob.id);
        }
        let policy = policy_repo::find_by_id(db, blob.policy_id).await?;
        let driver = state.driver_registry.get_driver(&policy)?;
        driver.delete(&blob.storage_path).await?;
        file_repo::delete_blob(db, blob.id).await?;
    } else {
        let mut active: file_blob::ActiveModel = blob.clone().into();
        active.ref_count = Set(blob.ref_count - 1);
        active.updated_at = Set(Utc::now());
        use sea_orm::ActiveModelTrait;
        active.update(db).await.map_err(AsterError::from)?;
    }

    Ok(())
}

/// 更新文件（重命名/移动）
pub async fn update(
    state: &AppState,
    id: i64,
    user_id: i64,
    name: Option<String>,
    folder_id: Option<i64>,
) -> Result<file::Model> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, id).await?;
    if f.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your file"));
    }
    let mut active: file::ActiveModel = f.into();
    if let Some(n) = name {
        active.name = Set(n);
    }
    if let Some(fid) = folder_id {
        active.folder_id = Set(Some(fid));
    }
    active.updated_at = Set(Utc::now());
    use sea_orm::ActiveModelTrait;
    active.update(db).await.map_err(AsterError::from)
}

/// 根据优先级链解析存储策略：文件夹 → 用户默认 → 系统默认
pub async fn resolve_policy(
    state: &AppState,
    user_id: i64,
    folder_id: Option<i64>,
) -> Result<crate::entities::storage_policy::Model> {
    let db = &state.db;

    // 1. 文件夹级策略
    if let Some(fid) = folder_id {
        let folder = crate::db::repository::folder_repo::find_by_id(db, fid).await?;
        if let Some(pid) = folder.policy_id {
            let cache_key = format!("policy:{pid}");
            if let Some(cached) = state
                .cache
                .get::<crate::entities::storage_policy::Model>(&cache_key)
                .await
            {
                return Ok(cached);
            }
            let policy = policy_repo::find_by_id(db, pid).await?;
            state.cache.set(&cache_key, &policy, None).await;
            return Ok(policy);
        }
    }

    // 2. 用户默认策略（缓存）
    let usp_cache_key = format!("user_default_policy:{user_id}");
    if let Some(usp) = state
        .cache
        .get::<user_storage_policy::Model>(&usp_cache_key)
        .await
    {
        let policy_cache_key = format!("policy:{}", usp.policy_id);
        if let Some(cached) = state
            .cache
            .get::<crate::entities::storage_policy::Model>(&policy_cache_key)
            .await
        {
            return Ok(cached);
        }
        let policy = policy_repo::find_by_id(db, usp.policy_id).await?;
        state.cache.set(&policy_cache_key, &policy, None).await;
        return Ok(policy);
    }

    if let Some(usp) = policy_repo::find_user_default(db, user_id).await? {
        state.cache.set(&usp_cache_key, &usp, None).await;
        let policy = policy_repo::find_by_id(db, usp.policy_id).await?;
        state
            .cache
            .set(&format!("policy:{}", policy.id), &policy, None)
            .await;
        return Ok(policy);
    }

    // 3. 系统默认策略
    policy_repo::find_default(db)
        .await?
        .ok_or_else(|| AsterError::storage_policy_not_found("no default storage policy configured"))
}
