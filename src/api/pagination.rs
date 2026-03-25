use chrono::{DateTime, Utc};
use serde::Deserialize;
use utoipa::IntoParams;

pub const DEFAULT_FOLDER_LIMIT: u64 = 200;
pub const DEFAULT_FILE_LIMIT: u64 = 100;
pub const MAX_PAGE_SIZE: u64 = 1000;

/// 文件列表分页参数（文件夹用 offset 分页，文件用 cursor 分页）
#[derive(Debug, Deserialize, IntoParams)]
pub struct FolderListQuery {
    /// 文件夹最大返回数量（默认 200，最大 1000；传 0 跳过文件夹查询）
    pub folder_limit: Option<u64>,
    /// 文件夹偏移量（默认 0）
    pub folder_offset: Option<u64>,
    /// 文件最大返回数量（默认 100，最大 1000；传 0 跳过文件查询）
    pub file_limit: Option<u64>,
    /// cursor 分页：上一页最后一条文件的 name（与 file_after_id 配合使用）
    pub file_after_name: Option<String>,
    /// cursor 分页：上一页最后一条文件的 id（与 file_after_name 配合使用）
    pub file_after_id: Option<i64>,
}

impl FolderListQuery {
    pub fn folder_limit(&self) -> u64 {
        self.folder_limit
            .map(|v| v.min(MAX_PAGE_SIZE))
            .unwrap_or(DEFAULT_FOLDER_LIMIT)
    }

    pub fn folder_offset(&self) -> u64 {
        self.folder_offset.unwrap_or(0)
    }

    pub fn file_limit(&self) -> u64 {
        self.file_limit
            .map(|v| v.min(MAX_PAGE_SIZE))
            .unwrap_or(DEFAULT_FILE_LIMIT)
    }

    /// 返回 cursor，两个字段必须同时存在才有效
    pub fn file_cursor(&self) -> Option<(String, i64)> {
        match (&self.file_after_name, self.file_after_id) {
            (Some(name), Some(id)) => Some((name.clone(), id)),
            _ => None,
        }
    }
}

/// 回收站分页参数（文件夹和文件均用 offset 分页，文件支持 cursor 分页）
#[derive(Debug, Deserialize, IntoParams)]
pub struct TrashListQuery {
    /// 文件夹最大返回数量（默认 200，最大 1000）
    pub folder_limit: Option<u64>,
    /// 文件夹偏移量（默认 0）
    pub folder_offset: Option<u64>,
    /// 文件最大返回数量（默认 100，最大 1000；传 0 跳过文件查询）
    pub file_limit: Option<u64>,
    /// cursor 分页：上一页最后一条文件的 deleted_at（RFC3339，与 file_after_id 配合使用）
    pub file_after_deleted_at: Option<DateTime<Utc>>,
    /// cursor 分页：上一页最后一条文件的 id（与 file_after_deleted_at 配合使用）
    pub file_after_id: Option<i64>,
}

impl TrashListQuery {
    pub fn folder_limit(&self) -> u64 {
        self.folder_limit
            .map(|v| v.min(MAX_PAGE_SIZE))
            .unwrap_or(DEFAULT_FOLDER_LIMIT)
    }

    pub fn folder_offset(&self) -> u64 {
        self.folder_offset.unwrap_or(0)
    }

    pub fn file_limit(&self) -> u64 {
        self.file_limit
            .map(|v| v.min(MAX_PAGE_SIZE))
            .unwrap_or(DEFAULT_FILE_LIMIT)
    }

    /// 返回 cursor，两个字段必须同时存在才有效
    pub fn file_cursor(&self) -> Option<(DateTime<Utc>, i64)> {
        match (self.file_after_deleted_at, self.file_after_id) {
            (Some(ts), Some(id)) => Some((ts, id)),
            _ => None,
        }
    }
}
