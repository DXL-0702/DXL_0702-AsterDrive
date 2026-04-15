use std::collections::{HashMap, HashSet};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use actix_web::HttpResponse;
use chrono::{Duration, Utc};
use sea_orm::{ActiveEnum, DatabaseConnection, Set};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
#[cfg(all(debug_assertions, feature = "openapi"))]
use utoipa::ToSchema;

use crate::api::pagination::OffsetPage;
use crate::config::operations;
use crate::db::repository::{background_task_repo, file_repo, folder_repo};
use crate::entities::{background_task, file, folder};
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::runtime::AppState;
use crate::services::{
    batch_service, folder_service, storage_change_service,
    workspace_storage_service::{self, WorkspaceStorageScope},
};
use crate::storage::{DriverRegistry, PolicySnapshot};
use crate::types::{
    BackgroundTaskKind, BackgroundTaskStatus, StoredTaskPayload, StoredTaskResult, StoredTaskSteps,
};

const DEFAULT_TASK_RETENTION_HOURS: i64 = 24;
const TASK_DISPATCH_BATCH_SIZE: u64 = 8;
const TASK_PROCESSING_STALE_SECS: i64 = 60;
const TASK_LAST_ERROR_MAX_LEN: usize = 1024;
const TASK_STATUS_TEXT_MAX_LEN: usize = 255;
const TASK_DRAIN_MAX_ROUNDS: usize = 32;
const TASK_CLEANUP_BATCH_SIZE: u64 = 64;
const TASK_STEP_WAITING: &str = "waiting";
const TASK_STEP_PREPARE_SOURCES: &str = "prepare_sources";
const TASK_STEP_BUILD_ARCHIVE: &str = "build_archive";
const TASK_STEP_STORE_RESULT: &str = "store_result";
const TASK_STEP_DOWNLOAD_SOURCE: &str = "download_source";
const TASK_STEP_EXTRACT_ARCHIVE: &str = "extract_archive";
const TASK_STEP_IMPORT_RESULT: &str = "import_result";

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct DispatchStats {
    pub claimed: usize,
    pub succeeded: usize,
    pub retried: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum TaskStepStatus {
    Pending,
    Active,
    Succeeded,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct TaskStepInfo {
    pub key: String,
    pub title: String,
    pub status: TaskStepStatus,
    pub progress_current: i64,
    pub progress_total: i64,
    pub detail: Option<String>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = Option<String>))]
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = Option<String>))]
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateArchiveTaskParams {
    pub file_ids: Vec<i64>,
    pub folder_ids: Vec<i64>,
    pub archive_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct CreateArchiveCompressTaskParams {
    #[serde(default)]
    pub file_ids: Vec<i64>,
    #[serde(default)]
    pub folder_ids: Vec<i64>,
    pub archive_name: Option<String>,
    pub target_folder_id: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct CreateArchiveExtractTaskParams {
    pub target_folder_id: Option<i64>,
    pub output_folder_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct ArchiveCompressTaskPayload {
    pub file_ids: Vec<i64>,
    pub folder_ids: Vec<i64>,
    pub archive_name: String,
    pub target_folder_id: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct ArchiveExtractTaskPayload {
    pub file_id: i64,
    pub source_file_name: String,
    pub target_folder_id: Option<i64>,
    pub output_folder_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct ArchiveCompressTaskResult {
    pub target_file_id: i64,
    pub target_file_name: String,
    pub target_folder_id: Option<i64>,
    pub target_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
pub struct ArchiveExtractTaskResult {
    pub target_folder_id: i64,
    pub target_folder_name: String,
    pub target_path: String,
    pub extracted_file_count: i64,
    pub extracted_folder_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TaskPayload {
    ArchiveCompress(ArchiveCompressTaskPayload),
    ArchiveExtract(ArchiveExtractTaskPayload),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TaskResult {
    ArchiveCompress(ArchiveCompressTaskResult),
    ArchiveExtract(ArchiveExtractTaskResult),
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
    pub payload: TaskPayload,
    pub result: Option<TaskResult>,
    pub steps: Vec<TaskStepInfo>,
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

#[derive(Debug, Clone, Copy)]
struct TaskStepSpec {
    key: &'static str,
    title: &'static str,
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
    let steps_json = serialize_task_steps(&initial_task_steps(task.kind))?;

    let now = Utc::now();
    if !background_task_repo::reset_for_manual_retry(
        &state.db,
        task.id,
        now,
        Some(steps_json.as_ref()),
    )
    .await?
    {
        return Err(AsterError::internal_error(format!(
            "failed to reset task #{} for retry",
            task.id
        )));
    }

    get_task_in_scope(state, scope, task_id).await
}

pub(crate) async fn create_archive_compress_task_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    params: CreateArchiveCompressTaskParams,
) -> Result<TaskInfo> {
    let resolved = resolve_archive_download_in_scope(
        state,
        scope,
        &CreateArchiveTaskParams {
            file_ids: params.file_ids,
            folder_ids: params.folder_ids,
            archive_name: params.archive_name,
        },
    )
    .await?;
    let target_folder_id = resolve_archive_compress_target_folder_id(
        state,
        scope,
        &resolved.selection,
        params.target_folder_id,
    )
    .await?;
    let payload = ArchiveCompressTaskPayload {
        file_ids: resolved.selection.file_ids.clone(),
        folder_ids: resolved.selection.folder_ids.clone(),
        archive_name: resolved.archive_name.clone(),
        target_folder_id,
    };
    let display_name = format!("Compress {}", payload.archive_name);
    let task = create_task_record(
        state,
        scope,
        BackgroundTaskKind::ArchiveCompress,
        &display_name,
        &payload,
    )
    .await?;
    build_task_info(state, task).await
}

pub(crate) async fn create_archive_extract_task_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    file_id: i64,
    params: CreateArchiveExtractTaskParams,
) -> Result<TaskInfo> {
    workspace_storage_service::require_scope_access(state, scope).await?;
    let source_file = workspace_storage_service::verify_file_access(state, scope, file_id).await?;
    workspace_storage_service::ensure_active_file_scope(&source_file, scope)?;
    ensure_extract_source_supported(&source_file)?;

    if let Some(target_folder_id) = params.target_folder_id {
        workspace_storage_service::verify_folder_access(state, scope, target_folder_id).await?;
    }

    let payload = ArchiveExtractTaskPayload {
        file_id: source_file.id,
        source_file_name: source_file.name.clone(),
        target_folder_id: params.target_folder_id.or(source_file.folder_id),
        output_folder_name: resolve_extract_output_folder_name(
            params.output_folder_name.as_ref(),
            &source_file.name,
        )?,
    };
    let display_name = format!("Extract {}", source_file.name);
    let task = create_task_record(
        state,
        scope,
        BackgroundTaskKind::ArchiveExtract,
        &display_name,
        &payload,
    )
    .await?;
    build_task_info(state, task).await
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
                let failed_steps_json =
                    build_failed_task_steps_json(state, task.id, task.kind, &error_message).await;
                if attempt_count >= task.max_attempts {
                    if background_task_repo::mark_failed(
                        &state.db,
                        task.id,
                        attempt_count,
                        &error_message,
                        Utc::now(),
                        task_expiration_from(state, Utc::now()),
                        failed_steps_json.as_deref(),
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
                        failed_steps_json.as_deref(),
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

async fn build_failed_task_steps_json(
    state: &AppState,
    task_id: i64,
    kind: BackgroundTaskKind,
    error_message: &str,
) -> Option<String> {
    let latest = background_task_repo::find_by_id(&state.db, task_id)
        .await
        .ok()?;
    let mut steps =
        parse_task_steps_json(latest.steps_json.as_ref().map(|raw| raw.as_ref()), kind).ok()?;
    if steps.is_empty() {
        return None;
    }
    mark_active_step_failed(&mut steps, Some(error_message));
    serialize_task_steps(&steps).ok().map(Into::into)
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
    let kind = task.kind;
    let payload = parse_task_payload_info(&task)?;
    let result = parse_task_result_info(&task)?;
    let steps = parse_task_steps_json(task.steps_json.as_ref().map(|raw| raw.as_ref()), kind)?;

    Ok(TaskInfo {
        id: task.id,
        kind,
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
        payload,
        result,
        steps,
        can_retry: task.status == BackgroundTaskStatus::Failed,
        started_at: task.started_at,
        finished_at: task.finished_at,
        expires_at: task.expires_at,
        created_at: task.created_at,
        updated_at: task.updated_at,
    })
}

async fn create_task_record<T: Serialize>(
    state: &AppState,
    scope: WorkspaceStorageScope,
    kind: BackgroundTaskKind,
    display_name: &str,
    payload: &T,
) -> Result<background_task::Model> {
    let now = Utc::now();
    let payload_json = serialize_task_payload(payload)?;
    let steps_json = serialize_task_steps(&initial_task_steps(kind))?;

    background_task_repo::create(
        &state.db,
        background_task::ActiveModel {
            kind: Set(kind),
            status: Set(BackgroundTaskStatus::Pending),
            creator_user_id: Set(Some(scope.actor_user_id())),
            team_id: Set(scope.team_id()),
            share_id: Set(None),
            display_name: Set(display_name.to_string()),
            payload_json: Set(payload_json),
            result_json: Set(None),
            steps_json: Set(Some(steps_json)),
            progress_current: Set(0),
            progress_total: Set(0),
            status_text: Set(None),
            attempt_count: Set(0),
            max_attempts: Set(1),
            next_run_at: Set(now),
            processing_started_at: Set(None),
            started_at: Set(None),
            finished_at: Set(None),
            last_error: Set(None),
            expires_at: Set(task_expiration_from(state, now)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        },
    )
    .await
}

async fn process_task(state: &AppState, task: &background_task::Model) -> Result<()> {
    match task.kind {
        BackgroundTaskKind::ArchiveCompress => process_archive_compress_task(state, task).await,
        BackgroundTaskKind::ArchiveExtract => process_archive_extract_task(state, task).await,
    }
}

async fn process_archive_compress_task(
    state: &AppState,
    task: &background_task::Model,
) -> Result<()> {
    let scope = task_scope(task)?;
    let payload: ArchiveCompressTaskPayload = parse_task_payload(task)?;
    let mut steps =
        parse_task_steps_json(task.steps_json.as_ref().map(|raw| raw.as_ref()), task.kind)?;
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_WAITING,
        Some("Worker claimed task"),
        None,
    )?;
    set_task_step_active(
        &mut steps,
        TASK_STEP_PREPARE_SOURCES,
        Some("Validating archive selection"),
        None,
    )?;
    if let Some(target_folder_id) = payload.target_folder_id {
        workspace_storage_service::verify_folder_access(state, scope, target_folder_id).await?;
    }

    let selection = batch_service::load_normalized_selection_in_scope(
        state,
        scope,
        &payload.file_ids,
        &payload.folder_ids,
    )
    .await?;
    ensure_archive_selection_active(scope, &selection)?;
    let (entries, total_bytes) =
        collect_archive_entries_from_selection_in_scope(state, scope, &selection).await?;
    let progress_total = total_bytes.max(0);
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_PREPARE_SOURCES,
        Some("Archive sources are ready"),
        None,
    )?;
    set_task_step_active(
        &mut steps,
        TASK_STEP_BUILD_ARCHIVE,
        Some("Packing archive"),
        Some((0, progress_total)),
    )?;
    mark_task_progress(
        state,
        task.id,
        0,
        progress_total,
        Some("Preparing archive"),
        &steps,
    )
    .await?;

    let task_temp_dir = prepare_task_temp_dir(state, task.id).await?;
    let archive_temp_path = Path::new(&task_temp_dir).join(&payload.archive_name);
    let archive_temp_path_string = archive_temp_path.to_string_lossy().to_string();
    let archive_temp_path_for_worker = archive_temp_path_string.clone();
    let handle = tokio::runtime::Handle::current();
    let db = state.db.clone();
    let driver_registry = state.driver_registry.clone();
    let policy_snapshot = state.policy_snapshot.clone();
    let task_id = task.id;
    let steps_for_worker = steps.clone();

    let (archive_size, mut steps) =
        tokio::task::spawn_blocking(move || -> Result<(i64, Vec<TaskStepInfo>)> {
            let file = std::fs::File::create(&archive_temp_path_for_worker)
                .map_aster_err_ctx("create archive temp file", AsterError::storage_driver_error)?;
            let writer = std::io::BufWriter::new(file);
            let mut steps = steps_for_worker;
            let (writer, _) = write_archive_to_sink(
                &handle,
                &db,
                driver_registry.as_ref(),
                policy_snapshot.as_ref(),
                entries,
                progress_total,
                writer,
                |current, entry_path| {
                    let status_text = format!("Packing {entry_path}");
                    set_task_step_active(
                        &mut steps,
                        TASK_STEP_BUILD_ARCHIVE,
                        Some(&status_text),
                        Some((current, progress_total)),
                    )?;
                    handle.block_on(async {
                        update_task_progress_db(
                            &db,
                            task_id,
                            current,
                            progress_total,
                            Some(&status_text),
                            &steps,
                        )
                        .await
                    })
                },
            )?;
            set_task_step_succeeded(
                &mut steps,
                TASK_STEP_BUILD_ARCHIVE,
                Some("Archive file created"),
                Some((progress_total, progress_total)),
            )?;
            writer
                .into_inner()
                .map_err(|error| AsterError::storage_driver_error(error.to_string()))?;
            let metadata = std::fs::metadata(&archive_temp_path_for_worker).map_aster_err_ctx(
                "read archive temp file metadata",
                AsterError::storage_driver_error,
            )?;
            Ok((
                i64::try_from(metadata.len()).map_err(|_| {
                    AsterError::internal_error("archive temp file exceeds i64 range")
                })?,
                steps,
            ))
        })
        .await
        .map_err(|error| {
            AsterError::internal_error(format!("archive compress worker failed: {error}"))
        })??;

    set_task_step_active(
        &mut steps,
        TASK_STEP_STORE_RESULT,
        Some("Saving archive to workspace"),
        None,
    )?;
    mark_task_progress(
        state,
        task.id,
        progress_total,
        progress_total,
        Some("Saving archive"),
        &steps,
    )
    .await?;
    let stored = workspace_storage_service::store_from_temp(
        state,
        scope,
        payload.target_folder_id,
        &payload.archive_name,
        &archive_temp_path_string,
        archive_size,
        None,
        false,
    )
    .await?;
    cleanup_task_temp_dir_for_task(state, task.id).await?;
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_STORE_RESULT,
        Some(&format!("Saved archive as {}", stored.name)),
        None,
    )?;

    let result = ArchiveCompressTaskResult {
        target_file_id: stored.id,
        target_file_name: stored.name.clone(),
        target_folder_id: stored.folder_id,
        target_path: build_file_display_path(&state.db, stored.folder_id, &stored.name).await?,
    };
    let result_json = serialize_task_result(&result)?;
    mark_task_succeeded(
        state,
        task.id,
        Some(&result_json),
        progress_total,
        progress_total,
        Some(&format!("Archive ready: {}", stored.name)),
        &steps,
    )
    .await
}

async fn process_archive_extract_task(
    state: &AppState,
    task: &background_task::Model,
) -> Result<()> {
    let scope = task_scope(task)?;
    let payload: ArchiveExtractTaskPayload = parse_task_payload(task)?;
    let mut steps =
        parse_task_steps_json(task.steps_json.as_ref().map(|raw| raw.as_ref()), task.kind)?;
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_WAITING,
        Some("Worker claimed task"),
        None,
    )?;
    let source_file =
        workspace_storage_service::verify_file_access(state, scope, payload.file_id).await?;
    workspace_storage_service::ensure_active_file_scope(&source_file, scope)?;
    ensure_extract_source_supported(&source_file)?;
    if let Some(target_folder_id) = payload.target_folder_id {
        workspace_storage_service::verify_folder_access(state, scope, target_folder_id).await?;
    }

    set_task_step_active(
        &mut steps,
        TASK_STEP_DOWNLOAD_SOURCE,
        Some("Downloading source archive"),
        None,
    )?;
    mark_task_progress(
        state,
        task.id,
        0,
        0,
        Some("Downloading source archive"),
        &steps,
    )
    .await?;
    let task_temp_dir = prepare_task_temp_dir(state, task.id).await?;
    let task_temp_path = Path::new(&task_temp_dir);
    let source_archive_path = task_temp_path.join("source.zip");
    let stage_root = task_temp_path.join("extract");
    tokio::fs::create_dir_all(&stage_root)
        .await
        .map_aster_err_ctx(
            "create archive extract staging dir",
            AsterError::storage_driver_error,
        )?;
    download_file_to_temp(state, &source_file, &source_archive_path).await?;
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_DOWNLOAD_SOURCE,
        Some("Source archive downloaded"),
        None,
    )?;
    let steps_for_worker = steps.clone();

    let db = state.db.clone();
    let handle = tokio::runtime::Handle::current();
    let task_id = task.id;
    let source_archive_path_string = source_archive_path.to_string_lossy().to_string();
    let stage_root_string = stage_root.to_string_lossy().to_string();
    let (staged, mut steps) = tokio::task::spawn_blocking(move || {
        let mut steps = steps_for_worker;
        let staged = stage_zip_archive_for_extract(
            &handle,
            &db,
            task_id,
            &source_archive_path_string,
            &stage_root_string,
            &mut steps,
        )?;
        Ok::<_, AsterError>((staged, steps))
    })
    .await
    .map_err(|error| {
        AsterError::internal_error(format!("archive extract worker failed: {error}"))
    })??;

    let created_root = create_unique_folder_in_scope(
        state,
        scope,
        payload.target_folder_id,
        &payload.output_folder_name,
    )
    .await?;
    storage_change_service::publish(
        state,
        storage_change_service::StorageChangeEvent::new(
            storage_change_service::StorageChangeKind::FolderCreated,
            scope,
            vec![],
            vec![created_root.id],
            vec![created_root.parent_id],
        ),
    );

    set_task_step_active(
        &mut steps,
        TASK_STEP_IMPORT_RESULT,
        Some("Importing extracted files"),
        Some((0, staged.total_bytes)),
    )?;
    mark_task_progress(
        state,
        task.id,
        staged.total_bytes,
        staged.total_progress,
        Some("Importing extracted files"),
        &steps,
    )
    .await?;
    materialize_archive_extract_stage(
        state,
        task,
        scope,
        &stage_root,
        staged.total_bytes,
        &created_root,
        &mut steps,
    )
    .await?;
    cleanup_task_temp_dir_for_task(state, task.id).await?;
    set_task_step_succeeded(
        &mut steps,
        TASK_STEP_IMPORT_RESULT,
        Some(&format!("Imported into {}", created_root.name)),
        Some((staged.total_bytes, staged.total_bytes)),
    )?;

    let result = ArchiveExtractTaskResult {
        target_folder_id: created_root.id,
        target_folder_name: created_root.name.clone(),
        target_path: build_folder_display_path(&state.db, created_root.id).await?,
        extracted_file_count: staged.file_count,
        extracted_folder_count: staged.directory_count,
    };
    let result_json = serialize_task_result(&result)?;
    let progress_total = staged.total_progress;
    mark_task_succeeded(
        state,
        task.id,
        Some(&result_json),
        progress_total,
        progress_total,
        Some(&format!("Extracted to {}", created_root.name)),
        &steps,
    )
    .await
}

#[derive(Debug)]
struct StagedArchiveStats {
    total_bytes: i64,
    total_progress: i64,
    file_count: i64,
    directory_count: i64,
}

#[derive(Debug, Default)]
struct StagedArchiveTree {
    directories: Vec<PathBuf>,
    files: Vec<PathBuf>,
}

fn task_scope(task: &background_task::Model) -> Result<WorkspaceStorageScope> {
    let actor_user_id = task.creator_user_id.ok_or_else(|| {
        AsterError::internal_error(format!("task #{} is missing creator_user_id", task.id))
    })?;
    Ok(match task.team_id {
        Some(team_id) => WorkspaceStorageScope::Team {
            team_id,
            actor_user_id,
        },
        None => WorkspaceStorageScope::Personal {
            user_id: actor_user_id,
        },
    })
}

fn parse_task_payload<T>(task: &background_task::Model) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_str(task.payload_json.as_ref()).map_err(|error| {
        AsterError::internal_error(format!(
            "parse payload for task #{} ({}): {error}",
            task.id,
            task.kind.to_value()
        ))
    })
}

fn parse_task_payload_info(task: &background_task::Model) -> Result<TaskPayload> {
    match task.kind {
        BackgroundTaskKind::ArchiveCompress => {
            Ok(TaskPayload::ArchiveCompress(parse_task_payload(task)?))
        }
        BackgroundTaskKind::ArchiveExtract => {
            Ok(TaskPayload::ArchiveExtract(parse_task_payload(task)?))
        }
    }
}

fn parse_task_result_info(task: &background_task::Model) -> Result<Option<TaskResult>> {
    let raw = match task.result_json.as_ref() {
        Some(raw) => raw,
        None => return Ok(None),
    };

    match task.kind {
        BackgroundTaskKind::ArchiveCompress => Ok(Some(TaskResult::ArchiveCompress(
            serde_json::from_str(raw.as_ref()).map_err(|error| {
                AsterError::internal_error(format!(
                    "parse result for task #{} ({}): {error}",
                    task.id,
                    task.kind.to_value()
                ))
            })?,
        ))),
        BackgroundTaskKind::ArchiveExtract => Ok(Some(TaskResult::ArchiveExtract(
            serde_json::from_str(raw.as_ref()).map_err(|error| {
                AsterError::internal_error(format!(
                    "parse result for task #{} ({}): {error}",
                    task.id,
                    task.kind.to_value()
                ))
            })?,
        ))),
    }
}

fn serialize_task_payload<T: Serialize>(payload: &T) -> Result<StoredTaskPayload> {
    serde_json::to_string(payload)
        .map(StoredTaskPayload)
        .map_err(|error| AsterError::internal_error(format!("serialize task payload: {error}")))
}

fn serialize_task_result<T: Serialize>(result: &T) -> Result<StoredTaskResult> {
    serde_json::to_string(result)
        .map(StoredTaskResult)
        .map_err(|error| AsterError::internal_error(format!("serialize task result: {error}")))
}

fn task_step_specs(kind: BackgroundTaskKind) -> &'static [TaskStepSpec] {
    match kind {
        BackgroundTaskKind::ArchiveCompress => &[
            TaskStepSpec {
                key: TASK_STEP_WAITING,
                title: "Waiting",
            },
            TaskStepSpec {
                key: TASK_STEP_PREPARE_SOURCES,
                title: "Prepare sources",
            },
            TaskStepSpec {
                key: TASK_STEP_BUILD_ARCHIVE,
                title: "Build archive",
            },
            TaskStepSpec {
                key: TASK_STEP_STORE_RESULT,
                title: "Save archive",
            },
        ],
        BackgroundTaskKind::ArchiveExtract => &[
            TaskStepSpec {
                key: TASK_STEP_WAITING,
                title: "Waiting",
            },
            TaskStepSpec {
                key: TASK_STEP_DOWNLOAD_SOURCE,
                title: "Download source archive",
            },
            TaskStepSpec {
                key: TASK_STEP_EXTRACT_ARCHIVE,
                title: "Extract archive",
            },
            TaskStepSpec {
                key: TASK_STEP_IMPORT_RESULT,
                title: "Import extracted files",
            },
        ],
    }
}

fn new_task_step(spec: TaskStepSpec, status: TaskStepStatus, detail: Option<&str>) -> TaskStepInfo {
    let now = (status == TaskStepStatus::Active).then(Utc::now);
    TaskStepInfo {
        key: spec.key.to_string(),
        title: spec.title.to_string(),
        status,
        progress_current: 0,
        progress_total: 0,
        detail: detail.map(str::to_string),
        started_at: now,
        finished_at: None,
    }
}

fn initial_task_steps(kind: BackgroundTaskKind) -> Vec<TaskStepInfo> {
    let mut steps = Vec::with_capacity(task_step_specs(kind).len());
    for (index, spec) in task_step_specs(kind).iter().enumerate() {
        steps.push(new_task_step(
            *spec,
            if index == 0 {
                TaskStepStatus::Active
            } else {
                TaskStepStatus::Pending
            },
            if index == 0 {
                Some("Waiting for worker")
            } else {
                None
            },
        ));
    }
    steps
}

fn parse_task_steps_json(
    steps_json: Option<&str>,
    _kind: BackgroundTaskKind,
) -> Result<Vec<TaskStepInfo>> {
    match steps_json {
        Some(raw) if !raw.trim().is_empty() => serde_json::from_str(raw)
            .map_err(|error| AsterError::internal_error(format!("parse task steps json: {error}"))),
        _ => Ok(Vec::new()),
    }
}

fn serialize_task_steps(steps: &[TaskStepInfo]) -> Result<StoredTaskSteps> {
    serde_json::to_string(steps)
        .map(StoredTaskSteps)
        .map_err(|error| AsterError::internal_error(format!("serialize task steps: {error}")))
}

fn find_task_step_mut<'a>(
    steps: &'a mut [TaskStepInfo],
    key: &str,
) -> Result<&'a mut TaskStepInfo> {
    steps
        .iter_mut()
        .find(|step| step.key == key)
        .ok_or_else(|| AsterError::internal_error(format!("task step '{key}' not found")))
}

fn set_task_step_active(
    steps: &mut [TaskStepInfo],
    key: &str,
    detail: Option<&str>,
    progress: Option<(i64, i64)>,
) -> Result<()> {
    let now = Utc::now();
    let step = find_task_step_mut(steps, key)?;
    step.status = TaskStepStatus::Active;
    if step.started_at.is_none() {
        step.started_at = Some(now);
    }
    step.finished_at = None;
    step.detail = detail.map(str::to_string);
    if let Some((current, total)) = progress {
        step.progress_current = current;
        step.progress_total = total;
    }
    Ok(())
}

fn set_task_step_succeeded(
    steps: &mut [TaskStepInfo],
    key: &str,
    detail: Option<&str>,
    progress: Option<(i64, i64)>,
) -> Result<()> {
    let now = Utc::now();
    let step = find_task_step_mut(steps, key)?;
    step.status = TaskStepStatus::Succeeded;
    if step.started_at.is_none() {
        step.started_at = Some(now);
    }
    step.finished_at = Some(now);
    step.detail = detail.map(str::to_string);
    if let Some((current, total)) = progress {
        step.progress_current = current;
        step.progress_total = total;
    } else if step.progress_total > 0 {
        step.progress_current = step.progress_total;
    }
    Ok(())
}

fn mark_active_step_failed(steps: &mut [TaskStepInfo], detail: Option<&str>) {
    let now = Utc::now();
    if let Some(step) = steps
        .iter_mut()
        .find(|step| step.status == TaskStepStatus::Active)
    {
        step.status = TaskStepStatus::Failed;
        if step.started_at.is_none() {
            step.started_at = Some(now);
        }
        step.finished_at = Some(now);
        step.detail = detail.map(str::to_string);
        return;
    }
    if let Some(step) = steps
        .iter_mut()
        .rev()
        .find(|step| step.status == TaskStepStatus::Pending)
    {
        step.status = TaskStepStatus::Failed;
        step.started_at = Some(now);
        step.finished_at = Some(now);
        step.detail = detail.map(str::to_string);
    }
}

async fn mark_task_progress(
    state: &AppState,
    task_id: i64,
    current: i64,
    total: i64,
    status_text: Option<&str>,
    steps: &[TaskStepInfo],
) -> Result<()> {
    update_task_progress_db(&state.db, task_id, current, total, status_text, steps).await
}

async fn update_task_progress_db(
    db: &DatabaseConnection,
    task_id: i64,
    current: i64,
    total: i64,
    status_text: Option<&str>,
    steps: &[TaskStepInfo],
) -> Result<()> {
    let status_text = status_text.map(truncate_status_text);
    let steps_json = serialize_task_steps(steps)?;
    if background_task_repo::mark_progress(
        db,
        task_id,
        current,
        total,
        status_text.as_deref(),
        Some(steps_json.as_ref()),
    )
    .await?
    {
        Ok(())
    } else {
        Err(AsterError::internal_error(format!(
            "failed to update background task #{} progress",
            task_id
        )))
    }
}

async fn mark_task_succeeded(
    state: &AppState,
    task_id: i64,
    result_json: Option<&StoredTaskResult>,
    current: i64,
    total: i64,
    status_text: Option<&str>,
    steps: &[TaskStepInfo],
) -> Result<()> {
    let now = Utc::now();
    let status_text = status_text.map(truncate_status_text);
    let steps_json = serialize_task_steps(steps)?;
    if background_task_repo::mark_succeeded(
        &state.db,
        task_id,
        result_json.map(AsRef::as_ref),
        Some(steps_json.as_ref()),
        current,
        total,
        status_text.as_deref(),
        now,
        task_expiration_from(state, now),
    )
    .await?
    {
        Ok(())
    } else {
        Err(AsterError::internal_error(format!(
            "failed to mark background task #{} as succeeded",
            task_id
        )))
    }
}

async fn prepare_task_temp_dir(state: &AppState, task_id: i64) -> Result<String> {
    cleanup_task_temp_dir_for_task(state, task_id).await?;
    let task_temp_dir = crate::utils::paths::task_temp_dir(&state.config.server.temp_dir, task_id);
    tokio::fs::create_dir_all(&task_temp_dir)
        .await
        .map_aster_err_ctx("create task temp dir", AsterError::storage_driver_error)?;
    Ok(task_temp_dir)
}

async fn download_file_to_temp(
    state: &AppState,
    source_file: &file::Model,
    temp_path: &Path,
) -> Result<()> {
    let blob = file_repo::find_blob_by_id(&state.db, source_file.blob_id).await?;
    let policy = state.policy_snapshot.get_policy_or_err(blob.policy_id)?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let mut stream = driver.get_stream(&blob.storage_path).await?;
    let mut output = tokio::fs::File::create(temp_path).await.map_aster_err_ctx(
        "create source archive temp file",
        AsterError::storage_driver_error,
    )?;
    tokio::io::copy(&mut stream, &mut output)
        .await
        .map_aster_err_ctx("download source archive", AsterError::storage_driver_error)?;
    output.flush().await.map_aster_err_ctx(
        "flush source archive temp file",
        AsterError::storage_driver_error,
    )?;
    Ok(())
}

fn stage_zip_archive_for_extract(
    handle: &tokio::runtime::Handle,
    db: &DatabaseConnection,
    task_id: i64,
    archive_path: &str,
    stage_root: &str,
    steps: &mut [TaskStepInfo],
) -> Result<StagedArchiveStats> {
    let file = std::fs::File::open(archive_path)
        .map_aster_err_ctx("open source archive", AsterError::storage_driver_error)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_aster_err_with(|| AsterError::validation_error("invalid zip archive"))?;
    let mut total_bytes = 0_i64;
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_aster_err_with(|| AsterError::validation_error("invalid zip archive entry"))?;
        if entry.is_dir() {
            continue;
        }
        total_bytes =
            total_bytes
                .checked_add(i64::try_from(entry.size()).map_err(|_| {
                    AsterError::internal_error("archive entry size exceeds i64 range")
                })?)
                .ok_or_else(|| AsterError::internal_error("archive extract size overflow"))?;
    }
    let total_progress = total_bytes
        .checked_mul(2)
        .ok_or_else(|| AsterError::internal_error("archive extract progress overflow"))?;
    set_task_step_active(
        steps,
        TASK_STEP_EXTRACT_ARCHIVE,
        Some("Reading archive"),
        Some((0, total_bytes)),
    )?;
    handle.block_on(async {
        update_task_progress_db(
            db,
            task_id,
            0,
            total_progress,
            Some("Reading archive"),
            steps,
        )
        .await
    })?;

    let mut processed_bytes = 0_i64;
    let mut created_dirs = HashSet::new();
    let mut file_count = 0_i64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_aster_err_with(|| AsterError::validation_error("invalid zip archive entry"))?;
        let enclosed_path = entry.enclosed_name().ok_or_else(|| {
            AsterError::validation_error(format!(
                "archive entry '{}' contains unsafe path",
                entry.name()
            ))
        })?;
        let relative_path = normalize_archive_entry_path(&enclosed_path)?;
        let target_path = Path::new(stage_root).join(&relative_path);
        if entry.is_dir() {
            register_relative_dirs(&mut created_dirs, &relative_path);
            std::fs::create_dir_all(&target_path).map_aster_err_ctx(
                "create extracted directory",
                AsterError::storage_driver_error,
            )?;
            continue;
        }

        if let Some(parent) = relative_path.parent() {
            register_relative_dirs(&mut created_dirs, parent);
        }
        if let Some(parent) = target_path.parent() {
            std::fs::create_dir_all(parent).map_aster_err_ctx(
                "create extracted parent directory",
                AsterError::storage_driver_error,
            )?;
        }

        let mut output = std::fs::File::create(&target_path)
            .map_aster_err_ctx("create extracted file", AsterError::storage_driver_error)?;
        let copied = std::io::copy(&mut entry, &mut output)
            .map_aster_err_ctx("extract zip entry", AsterError::storage_driver_error)?;
        processed_bytes = processed_bytes
            .checked_add(
                i64::try_from(copied)
                    .map_err(|_| AsterError::internal_error("extracted bytes exceed i64 range"))?,
            )
            .ok_or_else(|| AsterError::internal_error("archive extract progress overflow"))?;
        file_count += 1;

        let status_text = format!("Extracting {}", relative_path.to_string_lossy());
        set_task_step_active(
            steps,
            TASK_STEP_EXTRACT_ARCHIVE,
            Some(&status_text),
            Some((processed_bytes, total_bytes)),
        )?;
        handle.block_on(async {
            update_task_progress_db(
                db,
                task_id,
                processed_bytes,
                total_progress,
                Some(&status_text),
                steps,
            )
            .await
        })?;
    }

    set_task_step_succeeded(
        steps,
        TASK_STEP_EXTRACT_ARCHIVE,
        Some("Archive extracted to staging"),
        Some((total_bytes, total_bytes)),
    )?;

    Ok(StagedArchiveStats {
        total_bytes,
        total_progress,
        file_count,
        directory_count: i64::try_from(created_dirs.len())
            .map_err(|_| AsterError::internal_error("directory count exceeds i64 range"))?,
    })
}

async fn materialize_archive_extract_stage(
    state: &AppState,
    task: &background_task::Model,
    scope: WorkspaceStorageScope,
    stage_root: &Path,
    extracted_bytes: i64,
    root_folder: &folder::Model,
    steps: &mut [TaskStepInfo],
) -> Result<()> {
    let tree = collect_staged_archive_tree(stage_root)?;
    let mut folder_ids = HashMap::new();
    folder_ids.insert(PathBuf::new(), root_folder.id);
    let mut imported_bytes = 0_i64;
    let total_progress = extracted_bytes
        .checked_mul(2)
        .ok_or_else(|| AsterError::internal_error("archive extract progress overflow"))?;

    for relative_dir in &tree.directories {
        let parent_relative = relative_dir.parent().unwrap_or_else(|| Path::new(""));
        let parent_id = *folder_ids.get(parent_relative).ok_or_else(|| {
            AsterError::internal_error(format!(
                "missing parent folder mapping for '{}'",
                parent_relative.display()
            ))
        })?;
        let name = relative_dir
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| {
                AsterError::validation_error("archive directory name must be valid UTF-8")
            })?;
        let created = create_folder_exact_in_scope(state, scope, Some(parent_id), name).await?;
        folder_ids.insert(relative_dir.clone(), created.id);
    }

    for relative_file in &tree.files {
        let parent_relative = relative_file.parent().unwrap_or_else(|| Path::new(""));
        let parent_id = *folder_ids.get(parent_relative).ok_or_else(|| {
            AsterError::internal_error(format!(
                "missing parent folder mapping for '{}'",
                parent_relative.display()
            ))
        })?;
        let name = relative_file
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| AsterError::validation_error("archive file name must be valid UTF-8"))?;
        let temp_path = stage_root.join(relative_file);
        let metadata = tokio::fs::metadata(&temp_path).await.map_aster_err_ctx(
            "read extracted file metadata",
            AsterError::storage_driver_error,
        )?;
        let size = i64::try_from(metadata.len())
            .map_err(|_| AsterError::internal_error("extracted file size exceeds i64 range"))?;
        workspace_storage_service::store_from_temp_exact_name_with_hints(
            state,
            scope,
            Some(parent_id),
            name,
            &temp_path.to_string_lossy(),
            size,
            None,
            false,
            None,
            None,
        )
        .await?;
        imported_bytes = imported_bytes
            .checked_add(size)
            .ok_or_else(|| AsterError::internal_error("archive extract progress overflow"))?;
        let status_text = format!("Importing {}", relative_file.to_string_lossy());
        set_task_step_active(
            steps,
            TASK_STEP_IMPORT_RESULT,
            Some(&status_text),
            Some((imported_bytes, extracted_bytes)),
        )?;
        mark_task_progress(
            state,
            task.id,
            extracted_bytes
                .checked_add(imported_bytes)
                .ok_or_else(|| AsterError::internal_error("archive extract progress overflow"))?,
            total_progress,
            Some(&status_text),
            steps,
        )
        .await?;
    }

    Ok(())
}

fn collect_staged_archive_tree(stage_root: &Path) -> Result<StagedArchiveTree> {
    let mut tree = StagedArchiveTree::default();
    let mut stack = vec![PathBuf::new()];

    while let Some(current_relative) = stack.pop() {
        let current_dir = if current_relative.as_os_str().is_empty() {
            stage_root.to_path_buf()
        } else {
            stage_root.join(&current_relative)
        };
        let mut children = std::fs::read_dir(&current_dir)
            .map_aster_err_ctx(
                "read extracted staging directory",
                AsterError::storage_driver_error,
            )?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_aster_err_ctx(
                "read extracted staging directory entry",
                AsterError::storage_driver_error,
            )?;
        children.sort_by_key(|entry| entry.file_name());

        for child in children {
            let child_name = child.file_name();
            let child_relative = current_relative.join(&child_name);
            let file_type = child.file_type().map_aster_err_ctx(
                "read extracted staging file type",
                AsterError::storage_driver_error,
            )?;
            if file_type.is_dir() {
                tree.directories.push(child_relative.clone());
                stack.push(child_relative);
            } else if file_type.is_file() {
                tree.files.push(child_relative);
            }
        }
    }

    tree.directories.sort();
    tree.files.sort();
    Ok(tree)
}

async fn create_unique_folder_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    parent_id: Option<i64>,
    base_name: &str,
) -> Result<folder::Model> {
    let final_name =
        resolve_unique_folder_name_in_scope(state, scope, parent_id, base_name).await?;
    create_folder_exact_in_scope(state, scope, parent_id, &final_name).await
}

async fn create_folder_exact_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    parent_id: Option<i64>,
    name: &str,
) -> Result<folder::Model> {
    crate::utils::validate_name(name)?;
    let exists = match scope {
        WorkspaceStorageScope::Personal { user_id } => {
            folder_repo::find_by_name_in_parent(&state.db, user_id, parent_id, name)
                .await?
                .is_some()
        }
        WorkspaceStorageScope::Team { team_id, .. } => {
            folder_repo::find_by_name_in_team_parent(&state.db, team_id, parent_id, name)
                .await?
                .is_some()
        }
    };
    if exists {
        return Err(folder_repo::duplicate_name_error(name));
    }

    let now = Utc::now();
    folder_repo::create(
        &state.db,
        folder::ActiveModel {
            name: Set(name.to_string()),
            parent_id: Set(parent_id),
            team_id: Set(scope.team_id()),
            user_id: Set(scope.actor_user_id()),
            policy_id: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        },
    )
    .await
}

async fn resolve_unique_folder_name_in_scope(
    state: &AppState,
    scope: WorkspaceStorageScope,
    parent_id: Option<i64>,
    base_name: &str,
) -> Result<String> {
    let mut candidate = base_name.to_string();
    loop {
        let exists = match scope {
            WorkspaceStorageScope::Personal { user_id } => {
                folder_repo::find_by_name_in_parent(&state.db, user_id, parent_id, &candidate)
                    .await?
            }
            WorkspaceStorageScope::Team { team_id, .. } => {
                folder_repo::find_by_name_in_team_parent(&state.db, team_id, parent_id, &candidate)
                    .await?
            }
        };
        if exists.is_none() {
            return Ok(candidate);
        }
        candidate = crate::utils::next_copy_name(&candidate);
    }
}

async fn resolve_archive_compress_target_folder_id(
    state: &AppState,
    scope: WorkspaceStorageScope,
    selection: &batch_service::NormalizedSelection,
    requested_target_folder_id: Option<i64>,
) -> Result<Option<i64>> {
    if let Some(target_folder_id) = requested_target_folder_id {
        workspace_storage_service::verify_folder_access(state, scope, target_folder_id).await?;
        return Ok(Some(target_folder_id));
    }

    let mut parents = HashSet::new();
    for file_id in &selection.file_ids {
        let file = selection
            .file_map
            .get(file_id)
            .ok_or_else(|| AsterError::file_not_found(format!("file #{file_id}")))?;
        parents.insert(file.folder_id);
    }
    for folder_id in &selection.folder_ids {
        let folder = selection
            .folder_map
            .get(folder_id)
            .ok_or_else(|| AsterError::folder_not_found(format!("folder #{folder_id}")))?;
        parents.insert(folder.parent_id);
    }

    if parents.len() == 1 {
        Ok(parents.into_iter().next().unwrap_or(None))
    } else {
        Ok(None)
    }
}

fn ensure_extract_source_supported(source_file: &file::Model) -> Result<()> {
    if source_file.name.to_ascii_lowercase().ends_with(".zip") {
        Ok(())
    } else {
        Err(AsterError::validation_error(
            "online extract currently supports .zip files only",
        ))
    }
}

fn resolve_extract_output_folder_name(
    output_folder_name: Option<&String>,
    source_file_name: &str,
) -> Result<String> {
    let candidate = match output_folder_name.map(|value| value.trim()) {
        Some(value) if !value.is_empty() => value.to_string(),
        _ => default_extract_output_folder_name(source_file_name),
    };
    crate::utils::validate_name(&candidate)?;
    Ok(candidate)
}

fn default_extract_output_folder_name(source_file_name: &str) -> String {
    if let Some(stripped) = strip_zip_extension(source_file_name)
        && !stripped.is_empty()
    {
        return stripped.to_string();
    }
    format!("extracted-{}", Utc::now().format("%Y%m%d-%H%M%S"))
}

fn strip_zip_extension(name: &str) -> Option<&str> {
    if name.to_ascii_lowercase().ends_with(".zip") && name.len() > 4 {
        Some(&name[..name.len() - 4])
    } else {
        None
    }
}

fn normalize_archive_entry_path(path: &Path) -> Result<PathBuf> {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(name) => {
                let name = name.to_str().ok_or_else(|| {
                    AsterError::validation_error("archive entry name must be valid UTF-8")
                })?;
                crate::utils::validate_name(name)?;
                normalized.push(name);
            }
            _ => {
                return Err(AsterError::validation_error(format!(
                    "archive entry '{}' contains invalid path component",
                    path.display()
                )));
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(AsterError::validation_error(
            "archive entry path cannot be empty",
        ));
    }
    Ok(normalized)
}

fn register_relative_dirs(created_dirs: &mut HashSet<PathBuf>, path: &Path) {
    let mut current = PathBuf::new();
    for component in path.components() {
        if let Component::Normal(name) = component {
            current.push(name);
            created_dirs.insert(current.clone());
        }
    }
}

async fn build_folder_display_path(db: &DatabaseConnection, folder_id: i64) -> Result<String> {
    let mut paths = folder_service::build_folder_paths(db, &[folder_id]).await?;
    paths
        .remove(&folder_id)
        .ok_or_else(|| AsterError::record_not_found(format!("folder #{folder_id} path")))
}

async fn build_file_display_path(
    db: &DatabaseConnection,
    folder_id: Option<i64>,
    file_name: &str,
) -> Result<String> {
    match folder_id {
        Some(folder_id) => Ok(format!(
            "{}/{}",
            build_folder_display_path(db, folder_id).await?,
            file_name
        )),
        None => Ok(format!("/{file_name}")),
    }
}

fn truncate_status_text(value: &str) -> String {
    value.chars().take(TASK_STATUS_TEXT_MAX_LEN).collect()
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
