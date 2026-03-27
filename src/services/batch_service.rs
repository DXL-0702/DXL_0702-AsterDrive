use serde::Serialize;
use utoipa::ToSchema;

use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::services::{file_service, folder_service};

/// 单次批量操作最大条目数
pub const MAX_BATCH_ITEMS: usize = 1000;

/// 校验批量操作参数：至少一个 ID，不超过上限
pub fn validate_batch_ids(file_ids: &[i64], folder_ids: &[i64]) -> Result<()> {
    if file_ids.is_empty() && folder_ids.is_empty() {
        return Err(AsterError::validation_error(
            "at least one file or folder ID is required",
        ));
    }
    if file_ids.len() + folder_ids.len() > MAX_BATCH_ITEMS {
        return Err(AsterError::validation_error(format!(
            "batch size cannot exceed {MAX_BATCH_ITEMS} items",
        )));
    }
    Ok(())
}

#[derive(Serialize, ToSchema)]
pub struct BatchResult {
    pub succeeded: u32,
    pub failed: u32,
    pub errors: Vec<BatchItemError>,
}

#[derive(Serialize, ToSchema)]
pub struct BatchItemError {
    pub entity_type: String,
    pub entity_id: i64,
    pub error: String,
}

impl BatchResult {
    fn new() -> Self {
        Self {
            succeeded: 0,
            failed: 0,
            errors: vec![],
        }
    }

    fn record_success(&mut self) {
        self.succeeded += 1;
    }

    fn record_failure(&mut self, entity_type: &str, entity_id: i64, error: String) {
        self.failed += 1;
        self.errors.push(BatchItemError {
            entity_type: entity_type.to_string(),
            entity_id,
            error,
        });
    }
}

/// 批量删除（软删除 -> 回收站）
pub async fn batch_delete(
    state: &AppState,
    user_id: i64,
    file_ids: &[i64],
    folder_ids: &[i64],
) -> Result<BatchResult> {
    let mut result = BatchResult::new();

    for &id in file_ids {
        match file_service::delete(state, id, user_id).await {
            Ok(()) => result.record_success(),
            Err(e) => result.record_failure("file", id, e.to_string()),
        }
    }

    for &id in folder_ids {
        match folder_service::delete(state, id, user_id).await {
            Ok(()) => result.record_success(),
            Err(e) => result.record_failure("folder", id, e.to_string()),
        }
    }

    Ok(result)
}

/// 批量移动（target_folder_id = None 表示移到根目录）
pub async fn batch_move(
    state: &AppState,
    user_id: i64,
    file_ids: &[i64],
    folder_ids: &[i64],
    target_folder_id: Option<i64>,
) -> Result<BatchResult> {
    let mut result = BatchResult::new();

    for &id in file_ids {
        match file_service::move_file(state, id, user_id, target_folder_id).await {
            Ok(_) => result.record_success(),
            Err(e) => result.record_failure("file", id, e.to_string()),
        }
    }

    for &id in folder_ids {
        match folder_service::move_folder(state, id, user_id, target_folder_id).await {
            Ok(_) => result.record_success(),
            Err(e) => result.record_failure("folder", id, e.to_string()),
        }
    }

    Ok(result)
}

/// 批量复制（target_folder_id = None 表示复制到根目录）
///
/// 使用 `copy_file` / `copy_folder` 高层函数，自动处理：
/// - 权限检查
/// - 副本命名（冲突时递增 "Copy of ..."）
/// - blob ref_count 更新
/// - 配额检查
pub async fn batch_copy(
    state: &AppState,
    user_id: i64,
    file_ids: &[i64],
    folder_ids: &[i64],
    target_folder_id: Option<i64>,
) -> Result<BatchResult> {
    let mut result = BatchResult::new();

    for &id in file_ids {
        match file_service::copy_file(state, id, user_id, target_folder_id).await {
            Ok(_) => result.record_success(),
            Err(e) => result.record_failure("file", id, e.to_string()),
        }
    }

    for &id in folder_ids {
        match folder_service::copy_folder(state, id, user_id, target_folder_id).await {
            Ok(_) => result.record_success(),
            Err(e) => result.record_failure("folder", id, e.to_string()),
        }
    }

    Ok(result)
}
