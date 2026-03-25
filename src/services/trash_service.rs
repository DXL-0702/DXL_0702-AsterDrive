use serde::Serialize;
use utoipa::ToSchema;

use crate::db::repository::{config_repo, file_repo, folder_repo};
use crate::entities::{file, folder};
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::services::{file_service, webdav_service};

const DEFAULT_RETENTION_DAYS: i64 = 7;

#[derive(Serialize, ToSchema)]
pub struct TrashFileItem {
    pub id: i64,
    pub name: String,
    pub size: i64,
    pub mime_type: String,
    #[schema(value_type = String)]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[schema(value_type = String)]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[schema(value_type = String)]
    pub deleted_at: chrono::DateTime<chrono::Utc>,
    pub is_locked: bool,
    pub original_path: String,
}

#[derive(Serialize, ToSchema)]
pub struct TrashFolderItem {
    pub id: i64,
    pub name: String,
    #[schema(value_type = String)]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[schema(value_type = String)]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[schema(value_type = String)]
    pub deleted_at: chrono::DateTime<chrono::Utc>,
    pub is_locked: bool,
    pub original_path: String,
}

#[derive(Serialize, ToSchema)]
pub struct TrashContents {
    pub folders: Vec<TrashFolderItem>,
    pub files: Vec<TrashFileItem>,
    pub folders_total: u64,
    pub files_total: u64,
}

/// 列出用户回收站内容（分页）
pub async fn list_trash(
    state: &AppState,
    user_id: i64,
    folder_limit: u64,
    folder_offset: u64,
    file_limit: u64,
    file_offset: u64,
) -> Result<TrashContents> {
    let (raw_folders, folders_total) = folder_repo::find_top_level_deleted_paginated(
        &state.db,
        user_id,
        folder_limit,
        folder_offset,
    )
    .await?;

    let mut folders = Vec::new();
    for folder in raw_folders {
        folders.push(build_trash_folder_item(&state.db, folder).await?);
    }

    let (raw_files, files_total) =
        file_repo::find_top_level_deleted_paginated(&state.db, user_id, file_limit, file_offset)
            .await?;

    let mut files = Vec::new();
    for file in raw_files {
        files.push(build_trash_file_item(&state.db, file).await?);
    }

    Ok(TrashContents {
        folders,
        files,
        folders_total,
        files_total,
    })
}

async fn build_trash_file_item(
    db: &sea_orm::DatabaseConnection,
    file: file::Model,
) -> Result<TrashFileItem> {
    Ok(TrashFileItem {
        id: file.id,
        name: file.name,
        size: file.size,
        mime_type: file.mime_type,
        created_at: file.created_at,
        updated_at: file.updated_at,
        deleted_at: file
            .deleted_at
            .ok_or_else(|| AsterError::validation_error("file is not in trash"))?,
        is_locked: file.is_locked,
        original_path: resolve_folder_path(db, file.folder_id).await?,
    })
}

async fn build_trash_folder_item(
    db: &sea_orm::DatabaseConnection,
    folder: folder::Model,
) -> Result<TrashFolderItem> {
    Ok(TrashFolderItem {
        id: folder.id,
        name: folder.name,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
        deleted_at: folder
            .deleted_at
            .ok_or_else(|| AsterError::validation_error("folder is not in trash"))?,
        is_locked: folder.is_locked,
        original_path: resolve_folder_path(db, folder.parent_id).await?,
    })
}

async fn resolve_folder_path(
    db: &sea_orm::DatabaseConnection,
    folder_id: Option<i64>,
) -> Result<String> {
    let mut segments = Vec::new();
    let mut current = folder_id;

    while let Some(folder_id) = current {
        let folder = folder_repo::find_by_id(db, folder_id).await?;
        segments.push(folder.name);
        current = folder.parent_id;
    }

    segments.reverse();
    if segments.is_empty() {
        Ok("/".to_string())
    } else {
        Ok(format!("/{}", segments.join("/")))
    }
}

/// 恢复文件
pub async fn restore_file(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let f = file_repo::find_by_id(&state.db, id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "file")?;
    if f.deleted_at.is_none() {
        return Err(AsterError::validation_error("file is not in trash"));
    }

    // 如果原文件夹已删除，恢复到根目录
    if let Some(fid) = f.folder_id {
        let folder = folder_repo::find_by_id(&state.db, fid).await;
        if folder.is_err() || folder.is_ok_and(|f| f.deleted_at.is_some()) {
            // 原文件夹不存在或已删除，移到根目录
            let mut active: file::ActiveModel = f.into();
            active.folder_id = sea_orm::Set(None);
            active.deleted_at = sea_orm::Set(None);
            use sea_orm::ActiveModelTrait;
            active.update(&state.db).await.map_err(AsterError::from)?;
            return Ok(());
        }
    }

    file_repo::restore(&state.db, id).await
}

/// 恢复文件夹（递归恢复子项）
pub async fn restore_folder(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let f = folder_repo::find_by_id(&state.db, id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "folder")?;
    if f.deleted_at.is_none() {
        return Err(AsterError::validation_error("folder is not in trash"));
    }

    // 如果父文件夹已删除，恢复到根目录
    if let Some(pid) = f.parent_id {
        let parent = folder_repo::find_by_id(&state.db, pid).await;
        if parent.is_err() || parent.is_ok_and(|p| p.deleted_at.is_some()) {
            let mut active: folder::ActiveModel = f.into();
            active.parent_id = sea_orm::Set(None);
            active.deleted_at = sea_orm::Set(None);
            use sea_orm::ActiveModelTrait;
            active.update(&state.db).await.map_err(AsterError::from)?;
            // 还需要恢复子项
            recursive_restore(&state.db, user_id, id).await?;
            return Ok(());
        }
    }

    folder_repo::restore(&state.db, id).await?;
    recursive_restore(&state.db, user_id, id).await
}

/// 递归恢复子文件和子文件夹
async fn recursive_restore(
    db: &sea_orm::DatabaseConnection,
    user_id: i64,
    folder_id: i64,
) -> Result<()> {
    // 恢复该文件夹下的已删除文件（精确查询，不查全量）
    let deleted_files = file_repo::find_deleted_in_folder(db, folder_id).await?;
    for f in deleted_files {
        file_repo::restore(db, f.id).await?;
    }

    // 恢复已删除的子文件夹
    let deleted_folders = folder_repo::find_deleted_children(db, folder_id).await?;
    for child in deleted_folders {
        folder_repo::restore(db, child.id).await?;
        Box::pin(recursive_restore(db, user_id, child.id)).await?;
    }

    Ok(())
}

/// 永久删除单个文件
pub async fn purge_file(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let f = file_repo::find_by_id(&state.db, id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "file")?;
    if f.deleted_at.is_none() {
        return Err(AsterError::validation_error("file is not in trash"));
    }
    file_service::purge(state, id, user_id).await
}

/// 永久删除单个文件夹（递归）
pub async fn purge_folder(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let f = folder_repo::find_by_id(&state.db, id).await?;
    crate::utils::verify_owner(f.user_id, user_id, "folder")?;
    if f.deleted_at.is_none() {
        return Err(AsterError::validation_error("folder is not in trash"));
    }
    webdav_service::recursive_purge_folder(state, user_id, id).await
}

/// 清空用户回收站（返回实际成功删除数量）
///
/// 只处理顶层已删除项（文件夹内子项由 recursive_purge_folder 批量清理），
/// 避免同一文件被重复 purge。
pub async fn purge_all(state: &AppState, user_id: i64) -> Result<u32> {
    let mut count: u32 = 0;

    // 1. 先处理顶层已删除文件夹（批量递归清理内部所有文件和子文件夹）
    let (top_folders, _) =
        folder_repo::find_top_level_deleted_paginated(&state.db, user_id, 10000, 0).await?;
    for f in top_folders {
        match webdav_service::recursive_purge_folder(state, user_id, f.id).await {
            Ok(()) => count += 1,
            Err(e) => tracing::warn!("purge folder {} failed: {e}", f.id),
        }
    }

    // 2. 处理顶层已删除散文件（批量）
    let (top_files, _) =
        file_repo::find_top_level_deleted_paginated(&state.db, user_id, 10000, 0).await?;
    if !top_files.is_empty() {
        let file_count = top_files.len() as u32;
        match file_service::batch_purge(state, top_files, user_id).await {
            Ok(_) => count += file_count,
            Err(e) => tracing::warn!("batch purge top-level files failed: {e}"),
        }
    }

    Ok(count)
}

/// 自动清理过期回收站条目（后台任务调用）
pub async fn cleanup_expired(state: &AppState) -> Result<u32> {
    let retention_days = match config_repo::find_by_key(&state.db, "trash_retention_days").await? {
        Some(cfg) => cfg.value.parse::<i64>().unwrap_or_else(|_| {
            tracing::warn!(
                "invalid trash_retention_days value '{}', using default",
                cfg.value
            );
            DEFAULT_RETENTION_DAYS
        }),
        None => DEFAULT_RETENTION_DAYS,
    };

    let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);
    let mut count: u32 = 0;

    // 清理过期文件（批量）
    let expired_files = file_repo::find_expired_deleted(&state.db, cutoff).await?;
    let expired_file_count = expired_files.len() as u32;
    // 按 user_id 分组批量 purge
    let mut by_user: std::collections::HashMap<i64, Vec<file::Model>> =
        std::collections::HashMap::new();
    for f in expired_files {
        by_user.entry(f.user_id).or_default().push(f);
    }
    for (uid, files) in by_user {
        if let Err(e) = file_service::batch_purge(state, files, uid).await {
            tracing::warn!("trash cleanup expired files for user #{uid} failed: {e}");
        }
    }
    count += expired_file_count;

    // 清理过期文件夹——只处理顶层（父文件夹也过期则由父递归处理，避免重复）
    let expired_folders = folder_repo::find_expired_deleted(&state.db, cutoff).await?;
    let expired_folder_ids: std::collections::HashSet<i64> =
        expired_folders.iter().map(|f| f.id).collect();
    let top_level_folders: Vec<&folder::Model> = expired_folders
        .iter()
        .filter(|f| {
            f.parent_id
                .map_or(true, |pid| !expired_folder_ids.contains(&pid))
        })
        .collect();
    for f in &top_level_folders {
        if let Err(e) = webdav_service::recursive_purge_folder(state, f.user_id, f.id).await {
            tracing::warn!("trash cleanup folder {} failed: {e}", f.id);
        }
    }
    count += top_level_folders.len() as u32;

    if count > 0 {
        tracing::info!("trash cleanup: purged {count} expired items (retention={retention_days}d)");
    }
    Ok(count)
}
