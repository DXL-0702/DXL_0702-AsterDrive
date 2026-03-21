use chrono::Utc;
use sea_orm::Set;

use crate::db::repository::{config_repo, file_repo, policy_repo, version_repo};
use crate::entities::file_version;
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;

/// 列出文件的所有版本
pub async fn list_versions(
    state: &AppState,
    file_id: i64,
    user_id: i64,
) -> Result<Vec<file_version::Model>> {
    let f = file_repo::find_by_id(&state.db, file_id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "file")?;
    version_repo::find_by_file_id(&state.db, file_id).await
}

/// 恢复到指定版本（把文件 blob_id 换回旧版本的 blob，当前版本变成新的历史版本）
pub async fn restore_version(
    state: &AppState,
    file_id: i64,
    version_id: i64,
    user_id: i64,
) -> Result<crate::entities::file::Model> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, file_id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "file")?;
    if f.is_locked {
        return Err(AsterError::resource_locked("file is locked"));
    }

    let version = version_repo::find_by_id(db, version_id)
        .await?
        .ok_or_else(|| AsterError::record_not_found("version not found"))?;

    if version.file_id != file_id {
        return Err(AsterError::record_not_found("version not found"));
    }

    let now = Utc::now();

    // 删除当前 blob 的缩略图（恢复后缩略图按需重新生成）
    let current_blob = file_repo::find_blob_by_id(db, f.blob_id).await?;
    if let Err(e) = crate::services::thumbnail_service::delete_thumbnail(state, &current_blob).await
    {
        tracing::warn!(
            "failed to delete thumbnail for blob {}: {e}",
            current_blob.id
        );
    }

    // 直接切换 blob_id（不创建新版本记录，避免回滚产生冗余版本）
    let mut active: crate::entities::file::ActiveModel = f.into();
    active.blob_id = Set(version.blob_id);
    active.updated_at = Set(now);
    use sea_orm::ActiveModelTrait;
    let updated = active.update(db).await.map_err(AsterError::from)?;

    // 删除被恢复的版本记录（它现在是当前版本了）
    version_repo::delete_by_id(db, version_id).await?;

    Ok(updated)
}

/// 删除指定版本（减 blob ref_count）
pub async fn delete_version(
    state: &AppState,
    file_id: i64,
    version_id: i64,
    user_id: i64,
) -> Result<()> {
    let db = &state.db;
    let f = file_repo::find_by_id(db, file_id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "file")?;

    let version = version_repo::find_by_id(db, version_id)
        .await?
        .ok_or_else(|| AsterError::record_not_found("version not found"))?;

    if version.file_id != file_id {
        return Err(AsterError::record_not_found("version not found"));
    }

    version_repo::delete_by_id(db, version_id).await?;
    cleanup_blob_if_unused(state, version.blob_id).await?;

    Ok(())
}

/// 超出版本上限时清理最旧版本
pub async fn cleanup_excess(state: &AppState, file_id: i64) -> Result<()> {
    let db = &state.db;
    let max_versions = get_max_versions(state).await;

    loop {
        let count = version_repo::count_by_file_id(db, file_id).await?;
        if count <= max_versions {
            break;
        }
        let oldest = version_repo::find_oldest_by_file_id(db, file_id).await?;
        if let Some(oldest) = oldest {
            version_repo::delete_by_id(db, oldest.id).await?;
            cleanup_blob_if_unused(state, oldest.blob_id).await?;
        } else {
            break;
        }
    }

    Ok(())
}

/// 清理所有版本（文件永久删除时调用）
pub async fn purge_all_versions(state: &AppState, file_id: i64) -> Result<()> {
    let db = &state.db;
    let blob_ids = version_repo::delete_all_by_file_id(db, file_id).await?;

    for blob_id in blob_ids {
        cleanup_blob_if_unused(state, blob_id).await?;
    }

    Ok(())
}

/// 如果 blob 不再被任何文件或版本引用，减 ref_count 并可能删除物理文件
async fn cleanup_blob_if_unused(state: &AppState, blob_id: i64) -> Result<()> {
    let db = &state.db;
    let blob = file_repo::find_blob_by_id(db, blob_id).await?;

    if blob.ref_count <= 1 {
        // 删除物理文件 + 缩略图
        if let Err(e) = crate::services::thumbnail_service::delete_thumbnail(state, &blob).await {
            tracing::warn!("failed to delete thumbnail for blob {}: {e}", blob.id);
        }
        let policy = policy_repo::find_by_id(db, blob.policy_id).await?;
        let driver = state.driver_registry.get_driver(&policy)?;
        let _ = driver.delete(&blob.storage_path).await;
        file_repo::delete_blob(db, blob.id).await?;
    } else {
        let new_ref_count = blob.ref_count - 1;
        let mut active: crate::entities::file_blob::ActiveModel = blob.into();
        active.ref_count = Set(new_ref_count);
        active.updated_at = Set(Utc::now());
        use sea_orm::ActiveModelTrait;
        active.update(db).await.map_err(AsterError::from)?;
    }

    Ok(())
}

async fn get_max_versions(state: &AppState) -> u64 {
    match config_repo::find_by_key(&state.db, "max_versions_per_file").await {
        Ok(Some(cfg)) => cfg.value.parse().unwrap_or_else(|_| {
            tracing::warn!(
                "invalid max_versions_per_file value '{}', using 10",
                cfg.value
            );
            10
        }),
        _ => 10,
    }
}
