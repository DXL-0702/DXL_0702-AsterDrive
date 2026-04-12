use std::collections::{HashMap, HashSet};
use std::io::Write;

use actix_web::HttpResponse;
use chrono::{Duration, Utc};
use sea_orm::ActiveEnum;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
#[cfg(all(debug_assertions, feature = "openapi"))]
use utoipa::ToSchema;

use crate::api::pagination::OffsetPage;
use crate::config::operations;
use crate::db::repository::{background_task_repo, file_repo, folder_repo};
use crate::entities::{background_task, file, folder};
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::runtime::AppState;
use crate::services::{
    batch_service, folder_service,
    workspace_storage_service::{self, WorkspaceStorageScope},
};
use crate::storage::{DriverRegistry, PolicySnapshot};
use crate::types::{BackgroundTaskKind, BackgroundTaskStatus};

const DEFAULT_TASK_RETENTION_HOURS: i64 = 24;
const TASK_DISPATCH_BATCH_SIZE: u64 = 8;
const TASK_PROCESSING_STALE_SECS: i64 = 60;
const TASK_LAST_ERROR_MAX_LEN: usize = 1024;
const TASK_DRAIN_MAX_ROUNDS: usize = 32;
const TASK_CLEANUP_BATCH_SIZE: u64 = 64;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DispatchStats {
    pub claimed: usize,
    pub succeeded: usize,
    pub retried: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct TaskInfo {
    pub id: i64,
    pub kind: BackgroundTaskKind,
    pub status: BackgroundTaskStatus,
    pub display_name: String,
    pub creator_user_id: Option<i64>,
    pub team_id: Option<i64>,
    pub share_id: Option<i64>,
    pub progress_current: i64,
    pub progress_total: i64,
    pub progress_percent: i32,
    pub status_text: Option<String>,
    pub attempt_count: i32,
    pub max_attempts: i32,
    pub last_error: Option<String>,
    pub payload_json: String,
    pub result_json: Option<String>,
    pub can_retry: bool,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = Option<String>))]
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = Option<String>))]
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = String))]
    pub expires_at: chrono::DateTime<chrono::Utc>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = String))]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = String))]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateArchiveTaskParams {
    pub file_ids: Vec<i64>,
    pub folder_ids: Vec<i64>,
    pub archive_name: Option<String>,
}

pub(crate) struct PreparedArchiveDownload {
    pub file_ids: Vec<i64>,
    pub folder_ids: Vec<i64>,
    pub archive_name: String,
}

#[derive(Debug, Clone)]
enum ArchiveEntry {
    Directory {
        entry_path: String,
    },
    File {
        file: file::Model,
        entry_path: String,
    },
}

impl ArchiveEntry {
    fn entry_path(&self) -> &str {
        match self {
            Self::Directory { entry_path } | Self::File { entry_path, .. } => entry_path,
        }
    }

    fn is_file(&self) -> bool {
        matches!(self, Self::File { .. })
    }
}

pub(crate) async fn list_tasks_paginated_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    limit: u64,
    offset: u64,
) -> Result<OffsetPage<TaskInfo>> {
    workspace_storage_service::require_scope_access(state, scope).await?;

    let limit = limit.clamp(1, operations::task_list_max_limit(&state.runtime_config));
    let (tasks, total) = match scope {
        WorkspaceStorageScope::Personal { user_id } => {
            background_task_repo::find_paginated_personal(&state.db, user_id, limit, offset).await?
        }
        WorkspaceStorageScope::Team { team_id, .. } => {
            background_task_repo::find_paginated_team(&state.db, team_id, limit, offset).await?
        }
    };

    let mut items = Vec::with_capacity(tasks.len());
    for task in tasks {
        items.push(build_task_info(state, task).await?);
    }

    Ok(OffsetPage::new(items, total, limit, offset))
}

pub(crate) async fn get_task_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    task_id: i64,
) -> Result<TaskInfo> {
    workspace_storage_service::require_scope_access(state, scope).await?;
    let task = background_task_repo::find_by_id(&state.db, task_id).await?;
    ensure_task_in_scope(&task, scope)?;
    build_task_info(state, task).await
}

pub(crate) async fn retry_task_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    task_id: i64,
) -> Result<TaskInfo> {
    workspace_storage_service::require_scope_access(state, scope).await?;
    let task = background_task_repo::find_by_id(&state.db, task_id).await?;
    ensure_task_in_scope(&task, scope)?;

    if task.status != BackgroundTaskStatus::Failed {
        return Err(AsterError::validation_error(
            "only failed tasks can be retried",
        ));
    }

    cleanup_task_temp_dir_for_task(state, task.id).await?;

    let now = Utc::now();
    if !background_task_repo::reset_for_manual_retry(&state.db, task.id, now).await? {
        return Err(AsterError::internal_error(format!(
            "failed to reset task #{} for retry",
            task.id
        )));
    }

    get_task_in_scope(state, scope, task_id).await
}

pub(crate) async fn stream_archive_download_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    params: CreateArchiveTaskParams,
) -> Result<HttpResponse> {
    let resolved = resolve_archive_download_in_scope(state, scope, &params).await?;
    let archive_name = resolved.archive_name.clone();
    let (entries, total_bytes) =
        collect_archive_entries_from_selection_in_scope(state, scope, &resolved.selection).await?;

    let (reader, writer) = tokio::io::duplex(64 * 1024);
    let handle = tokio::runtime::Handle::current();
    let db = state.db.clone();
    let driver_registry = state.driver_registry.clone();
    let policy_snapshot = state.policy_snapshot.clone();
    let archive_name_for_worker = archive_name.clone();

    drop(tokio::task::spawn_blocking(move || {
        let writer = tokio_util::io::SyncIoBridge::new(writer);
        let writer = std::io::BufWriter::new(writer);
        if let Err(error) = write_archive_to_sink(
            &handle,
            &db,
            driver_registry.as_ref(),
            policy_snapshot.as_ref(),
            entries,
            total_bytes,
            writer,
            |_, _| Ok(()),
        ) {
            let error_text = error.to_string();
            if is_client_disconnect_error_text(&error_text) {
                tracing::info!(
                    archive_name = %archive_name_for_worker,
                    "archive download stream stopped after client disconnected"
                );
            } else {
                tracing::warn!(
                    archive_name = %archive_name_for_worker,
                    error = %error_text,
                    "archive download stream failed"
                );
            }
        }
    }));

    let reader_stream = tokio_util::io::ReaderStream::with_capacity(reader, 64 * 1024);

    Ok(HttpResponse::Ok()
        .content_type("application/zip")
        .insert_header((
            "Content-Disposition",
            format!(r#"attachment; filename="{}""#, archive_name),
        ))
        .insert_header(("Content-Encoding", "identity"))
        .streaming(reader_stream))
}

pub(crate) async fn prepare_archive_download_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    params: &CreateArchiveTaskParams,
) -> Result<PreparedArchiveDownload> {
    let resolved = resolve_archive_download_in_scope(state, scope, params).await?;
    Ok(PreparedArchiveDownload {
        file_ids: resolved.selection.file_ids,
        folder_ids: resolved.selection.folder_ids,
        archive_name: resolved.archive_name,
    })
}

pub async fn dispatch_due(state: &AppState) -> Result<DispatchStats> {
    let now = Utc::now();
    let stale_before = now - Duration::seconds(TASK_PROCESSING_STALE_SECS);
    let due = background_task_repo::list_claimable(
        &state.db,
        now,
        stale_before,
        TASK_DISPATCH_BATCH_SIZE,
    )
    .await?;
    let mut stats = DispatchStats::default();

    for task in due {
        let claimed_at = Utc::now();
        if !background_task_repo::try_claim(&state.db, task.id, claimed_at, stale_before).await? {
            continue;
        }

        stats.claimed += 1;
        match process_task(state, &task).await {
            Ok(()) => stats.succeeded += 1,
            Err(error) => {
                let attempt_count = task.attempt_count + 1;
                let error_message = truncate_error(&error.to_string());
                if attempt_count >= task.max_attempts {
                    if background_task_repo::mark_failed(
                        &state.db,
                        task.id,
                        attempt_count,
                        &error_message,
                        Utc::now(),
                        task_expiration_from(state, Utc::now()),
                    )
                    .await?
                    {
                        stats.failed += 1;
                    }
                    tracing::warn!(
                        task_id = task.id,
                        kind = %task.kind.to_value(),
                        attempt_count,
                        error = %error_message,
                        "background task permanently failed"
                    );
                } else {
                    let retry_at = Utc::now() + Duration::seconds(retry_delay_secs(attempt_count));
                    if background_task_repo::mark_retry(
                        &state.db,
                        task.id,
                        attempt_count,
                        retry_at,
                        &error_message,
                    )
                    .await?
                    {
                        stats.retried += 1;
                    }
                    tracing::warn!(
                        task_id = task.id,
                        kind = %task.kind.to_value(),
                        attempt_count,
                        retry_at = %retry_at,
                        error = %error_message,
                        "background task failed; scheduled retry"
                    );
                }
            }
        }
    }

    Ok(stats)
}

pub async fn drain(state: &AppState) -> Result<DispatchStats> {
    let mut total = DispatchStats::default();

    for _ in 0..TASK_DRAIN_MAX_ROUNDS {
        let stats = dispatch_due(state).await?;
        let claimed = stats.claimed;
        total.claimed += stats.claimed;
        total.succeeded += stats.succeeded;
        total.retried += stats.retried;
        total.failed += stats.failed;
        if claimed == 0 {
            break;
        }
    }

    Ok(total)
}

pub async fn cleanup_expired(state: &AppState) -> Result<u64> {
    let now = Utc::now();
    let expired_tasks =
        background_task_repo::list_expired_terminal(&state.db, now, TASK_CLEANUP_BATCH_SIZE)
            .await?;
    for task in &expired_tasks {
        crate::utils::cleanup_temp_dir(&crate::utils::paths::task_temp_dir(
            &state.config.server.temp_dir,
            task.id,
        ))
        .await;
    }
    let removed_tasks = background_task_repo::delete_many(
        &state.db,
        &expired_tasks.iter().map(|task| task.id).collect::<Vec<_>>(),
    )
    .await?;

    Ok(removed_tasks)
}

async fn build_task_info(_state: &AppState, task: background_task::Model) -> Result<TaskInfo> {
    let progress_percent = if task.progress_total <= 0 {
        if task.status == BackgroundTaskStatus::Succeeded {
            100
        } else {
            0
        }
    } else {
        ((task.progress_current.saturating_mul(100)) / task.progress_total).clamp(0, 100) as i32
    };

    Ok(TaskInfo {
        id: task.id,
        kind: task.kind,
        status: task.status,
        display_name: task.display_name,
        creator_user_id: task.creator_user_id,
        team_id: task.team_id,
        share_id: task.share_id,
        progress_current: task.progress_current,
        progress_total: task.progress_total,
        progress_percent,
        status_text: task.status_text,
        attempt_count: task.attempt_count,
        max_attempts: task.max_attempts,
        last_error: task.last_error,
        payload_json: task.payload_json,
        result_json: task.result_json,
        can_retry: task.status == BackgroundTaskStatus::Failed,
        started_at: task.started_at,
        finished_at: task.finished_at,
        expires_at: task.expires_at,
        created_at: task.created_at,
        updated_at: task.updated_at,
    })
}

async fn process_task(_state: &AppState, task: &background_task::Model) -> Result<()> {
    Err(AsterError::internal_error(format!(
        "task kind '{}' is not implemented",
        task.kind.to_value()
    )))
}

#[allow(clippy::too_many_arguments)]
fn write_archive_to_sink<W, F>(
    handle: &tokio::runtime::Handle,
    db: &DatabaseConnection,
    driver_registry: &DriverRegistry,
    policy_snapshot: &PolicySnapshot,
    entries: Vec<ArchiveEntry>,
    total_bytes: i64,
    output: W,
    mut on_progress: F,
) -> Result<(W, i64)>
where
    W: Write,
    F: FnMut(i64, &str) -> Result<()>,
{
    let mut zip = zip::ZipWriter::new_stream(output);
    let file_options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    let dir_options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut processed_bytes = 0_i64;

    for entry in entries {
        match entry {
            ArchiveEntry::Directory { entry_path } => {
                zip.add_directory(&entry_path, dir_options)
                    .map_aster_err(AsterError::storage_driver_error)?;
            }
            ArchiveEntry::File { file, entry_path } => {
                zip.start_file(&entry_path, file_options)
                    .map_aster_err(AsterError::storage_driver_error)?;

                let stream = handle.block_on(async {
                    let blob = file_repo::find_blob_by_id(db, file.blob_id).await?;
                    let policy = policy_snapshot.get_policy_or_err(blob.policy_id)?;
                    let driver = driver_registry.get_driver(&policy)?;
                    driver.get_stream(&blob.storage_path).await
                })?;

                let mut reader = tokio_util::io::SyncIoBridge::new(stream);
                let copied = std::io::copy(&mut reader, &mut zip)
                    .map_aster_err_ctx("stream file into zip", AsterError::storage_driver_error)?;
                processed_bytes = processed_bytes
                    .checked_add(i64::try_from(copied).map_err(|_| {
                        AsterError::internal_error(format!(
                            "copied bytes exceed i64 range: {copied}"
                        ))
                    })?)
                    .ok_or_else(|| AsterError::internal_error("archive progress overflow"))?;

                on_progress(processed_bytes, &entry_path)?;
            }
        }
    }

    let output = zip
        .finish()
        .map_aster_err(AsterError::storage_driver_error)?
        .into_inner();
    Ok((output, processed_bytes.max(total_bytes)))
}

fn is_client_disconnect_error_text(error_text: &str) -> bool {
    error_text.contains("Broken pipe")
        || error_text.contains("Connection reset by peer")
        || error_text.contains("connection closed")
}

async fn cleanup_task_temp_dir_for_task(state: &AppState, task_id: i64) -> Result<()> {
    crate::utils::cleanup_temp_dir(&crate::utils::paths::task_temp_dir(
        &state.config.server.temp_dir,
        task_id,
    ))
    .await;
    Ok(())
}

struct ResolvedArchiveDownload {
    selection: batch_service::NormalizedSelection,
    archive_name: String,
}

async fn resolve_archive_download_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    params: &CreateArchiveTaskParams,
) -> Result<ResolvedArchiveDownload> {
    ensure_archive_selection_request_in_scope(state, scope, &params.file_ids, &params.folder_ids)
        .await?;
    let selection = batch_service::load_normalized_selection_in_scope(
        state,
        scope,
        &params.file_ids,
        &params.folder_ids,
    )
    .await?;
    ensure_archive_selection_active(scope, &selection)?;
    let archive_name = resolve_archive_name(&params.archive_name, &selection)?;

    Ok(ResolvedArchiveDownload {
        selection,
        archive_name,
    })
}

async fn ensure_archive_selection_request_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    file_ids: &[i64],
    folder_ids: &[i64],
) -> Result<()> {
    workspace_storage_service::require_scope_access(state, scope).await?;
    batch_service::validate_batch_ids(file_ids, folder_ids)?;

    let file_map: HashMap<i64, file::Model> = file_repo::find_by_ids(&state.db, file_ids)
        .await?
        .into_iter()
        .map(|file| (file.id, file))
        .collect();
    for &file_id in file_ids {
        let file = file_map
            .get(&file_id)
            .ok_or_else(|| AsterError::file_not_found(format!("file #{file_id}")))?;
        workspace_storage_service::ensure_active_file_scope(file, scope)?;
    }

    let folder_map: HashMap<i64, folder::Model> = folder_repo::find_by_ids(&state.db, folder_ids)
        .await?
        .into_iter()
        .map(|folder| (folder.id, folder))
        .collect();
    for &folder_id in folder_ids {
        let folder = folder_map
            .get(&folder_id)
            .ok_or_else(|| AsterError::folder_not_found(format!("folder #{folder_id}")))?;
        workspace_storage_service::ensure_active_folder_scope(folder, scope)?;
    }

    Ok(())
}

fn ensure_archive_selection_active(
    scope: WorkspaceStorageScope,
    selection: &batch_service::NormalizedSelection,
) -> Result<()> {
    for &file_id in &selection.file_ids {
        let file = selection
            .file_map
            .get(&file_id)
            .ok_or_else(|| AsterError::file_not_found(format!("file #{file_id}")))?;
        workspace_storage_service::ensure_active_file_scope(file, scope)?;
    }

    for &folder_id in &selection.folder_ids {
        let folder = selection
            .folder_map
            .get(&folder_id)
            .ok_or_else(|| AsterError::folder_not_found(format!("folder #{folder_id}")))?;
        workspace_storage_service::ensure_active_folder_scope(folder, scope)?;
    }

    Ok(())
}

async fn collect_archive_entries_from_selection_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    selection: &batch_service::NormalizedSelection,
) -> Result<(Vec<ArchiveEntry>, i64)> {
    let mut entries = Vec::new();
    let mut total_bytes = 0_i64;
    let mut reserved_root_names = HashSet::new();

    for &file_id in &selection.file_ids {
        let file = selection
            .file_map
            .get(&file_id)
            .ok_or_else(|| AsterError::file_not_found(format!("file #{file_id}")))?;
        workspace_storage_service::ensure_active_file_scope(file, scope)?;
        let entry_path = batch_service::reserve_unique_name(&mut reserved_root_names, &file.name);
        total_bytes = total_bytes
            .checked_add(file.size)
            .ok_or_else(|| AsterError::internal_error("archive size overflow"))?;
        entries.push(ArchiveEntry::File {
            file: file.clone(),
            entry_path,
        });
    }

    for &folder_id in &selection.folder_ids {
        let folder = selection
            .folder_map
            .get(&folder_id)
            .ok_or_else(|| AsterError::folder_not_found(format!("folder #{folder_id}")))?;
        workspace_storage_service::ensure_active_folder_scope(folder, scope)?;
        let archive_root =
            batch_service::reserve_unique_name(&mut reserved_root_names, &folder.name);

        let (tree_files, tree_folder_ids) =
            folder_service::collect_folder_tree_in_scope(&state.db, scope, folder_id, false)
                .await?;
        let folder_paths = folder_service::build_folder_paths(&state.db, &tree_folder_ids).await?;
        let root_path = folder_paths
            .get(&folder_id)
            .cloned()
            .ok_or_else(|| AsterError::record_not_found(format!("folder #{folder_id} path")))?;

        for tree_folder_id in &tree_folder_ids {
            let folder_path = folder_paths.get(tree_folder_id).ok_or_else(|| {
                AsterError::record_not_found(format!("folder #{tree_folder_id} path"))
            })?;
            let entry_path = archive_directory_entry_path(&archive_root, folder_path, &root_path)?;
            entries.push(ArchiveEntry::Directory { entry_path });
        }

        for file in tree_files {
            let parent_path = file
                .folder_id
                .and_then(|id| folder_paths.get(&id))
                .ok_or_else(|| {
                    AsterError::record_not_found(format!(
                        "missing parent path for file #{}",
                        file.id
                    ))
                })?;
            let relative_dir = if parent_path == &root_path {
                String::new()
            } else {
                parent_path
                    .strip_prefix(&(root_path.clone() + "/"))
                    .ok_or_else(|| {
                        AsterError::internal_error(format!(
                            "folder path '{parent_path}' is outside root '{root_path}'"
                        ))
                    })?
                    .to_string()
            };
            let entry_path = if relative_dir.is_empty() {
                format!("{archive_root}/{}", file.name)
            } else {
                format!("{archive_root}/{relative_dir}/{}", file.name)
            };
            total_bytes = total_bytes
                .checked_add(file.size)
                .ok_or_else(|| AsterError::internal_error("archive size overflow"))?;
            entries.push(ArchiveEntry::File { file, entry_path });
        }
    }

    entries.sort_by(|left, right| {
        left.entry_path()
            .cmp(right.entry_path())
            .then_with(|| left.is_file().cmp(&right.is_file()))
    });
    Ok((entries, total_bytes))
}

fn archive_directory_entry_path(
    archive_root: &str,
    folder_path: &str,
    root_path: &str,
) -> Result<String> {
    if folder_path == root_path {
        return Ok(format!("{archive_root}/"));
    }

    let relative_dir = folder_path
        .strip_prefix(&(root_path.to_string() + "/"))
        .ok_or_else(|| {
            AsterError::internal_error(format!(
                "folder path '{folder_path}' is outside root '{root_path}'"
            ))
        })?;
    Ok(format!("{archive_root}/{relative_dir}/"))
}

fn ensure_task_in_scope(task: &background_task::Model, scope: WorkspaceStorageScope) -> Result<()> {
    match scope {
        WorkspaceStorageScope::Personal { user_id } => {
            if task.team_id.is_some() {
                return Err(AsterError::auth_forbidden(
                    "task belongs to a team workspace",
                ));
            }
            crate::utils::verify_owner(task.creator_user_id.unwrap_or_default(), user_id, "task")?;
        }
        WorkspaceStorageScope::Team { team_id, .. } => {
            if task.team_id != Some(team_id) {
                return Err(AsterError::auth_forbidden("task is outside team workspace"));
            }
        }
    }

    Ok(())
}

fn resolve_archive_name(
    archive_name: &Option<String>,
    selection: &batch_service::NormalizedSelection,
) -> Result<String> {
    let base = match archive_name.as_deref().map(str::trim) {
        Some(name) if !name.is_empty() => name.to_string(),
        _ => default_archive_name(selection),
    };
    let final_name = if base.to_ascii_lowercase().ends_with(".zip") {
        base
    } else {
        format!("{base}.zip")
    };
    crate::utils::validate_name(&final_name)?;
    Ok(final_name)
}

fn default_archive_name(selection: &batch_service::NormalizedSelection) -> String {
    if selection.folder_ids.len() == 1
        && selection.file_ids.is_empty()
        && let Some(folder) = selection.folder_map.get(&selection.folder_ids[0])
    {
        return folder.name.clone();
    }

    if selection.file_ids.len() == 1
        && selection.folder_ids.is_empty()
        && let Some(file) = selection.file_map.get(&selection.file_ids[0])
    {
        return file.name.clone();
    }

    format!("archive-{}", Utc::now().format("%Y%m%d-%H%M%S"))
}

fn task_expiration_from(
    state: &AppState,
    now: chrono::DateTime<chrono::Utc>,
) -> chrono::DateTime<chrono::Utc> {
    now + Duration::hours(load_task_retention_hours(state))
}

fn load_task_retention_hours(state: &AppState) -> i64 {
    let Some(raw) = state.runtime_config.get("task_retention_hours") else {
        return DEFAULT_TASK_RETENTION_HOURS;
    };
    match raw.parse::<i64>() {
        Ok(hours) if hours > 0 => hours,
        _ => {
            tracing::warn!(
                "invalid task_retention_hours value '{}', using default",
                raw
            );
            DEFAULT_TASK_RETENTION_HOURS
        }
    }
}

fn retry_delay_secs(attempt_count: i32) -> i64 {
    match attempt_count {
        1 => 5,
        2 => 15,
        3 => 60,
        _ => 300,
    }
}

fn truncate_error(error: &str) -> String {
    error.chars().take(TASK_LAST_ERROR_MAX_LEN).collect()
}
