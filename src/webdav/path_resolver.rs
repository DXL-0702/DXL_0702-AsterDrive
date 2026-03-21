use dav_server::davpath::DavPath;
use dav_server::fs::FsError;
use sea_orm::DatabaseConnection;

use crate::db::repository::{file_repo, folder_repo};
use crate::entities::{file, folder};

/// 路径解析结果
#[derive(Debug, Clone)]
pub enum ResolvedNode {
    /// 根目录 (parent_id = None)
    Root,
    /// 数据库中的文件夹
    Folder(folder::Model),
    /// 数据库中的文件
    File(file::Model),
}

/// 从 DavPath 提取路径段（已解码）
fn path_segments(path: &DavPath) -> Vec<String> {
    // as_bytes() 返回不含前缀、已解码的原始字节
    let raw = path.as_bytes();
    let path_str = String::from_utf8_lossy(raw);
    path_str
        .split('/')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// 解析 WebDAV 路径到数据库实体
///
/// 路径 `/Documents/Photos/vacation.jpg` 会逐段 walk：
/// 1. "Documents" → find_by_name_in_parent(None)
/// 2. "Photos" → find_by_name_in_parent(Some(docs_id))
/// 3. "vacation.jpg" → 先查 folder，再查 file
pub async fn resolve_path(
    db: &DatabaseConnection,
    user_id: i64,
    path: &DavPath,
    root_folder_id: Option<i64>,
) -> Result<ResolvedNode, FsError> {
    let segments = path_segments(path);

    if segments.is_empty() {
        return Ok(ResolvedNode::Root);
    }

    let mut current_parent: Option<i64> = root_folder_id;

    // 前 N-1 段必须是文件夹
    for segment in &segments[..segments.len() - 1] {
        let folder = folder_repo::find_by_name_in_parent(db, user_id, current_parent, segment)
            .await
            .map_err(|_| FsError::GeneralFailure)?
            .ok_or(FsError::NotFound)?;
        current_parent = Some(folder.id);
    }

    // 最后一段：先查文件夹，再查文件
    let last = &segments[segments.len() - 1];

    if let Some(folder) = folder_repo::find_by_name_in_parent(db, user_id, current_parent, last)
        .await
        .map_err(|_| FsError::GeneralFailure)?
    {
        return Ok(ResolvedNode::Folder(folder));
    }

    if let Some(file) = file_repo::find_by_name_in_folder(db, user_id, current_parent, last)
        .await
        .map_err(|_| FsError::GeneralFailure)?
    {
        return Ok(ResolvedNode::File(file));
    }

    Err(FsError::NotFound)
}

/// 解析路径的父目录，返回 (parent_folder_id, 末段文件名)
///
/// `/Documents/file.txt` → (Some(docs_id), "file.txt")
/// `/file.txt` → (None, "file.txt")
pub async fn resolve_parent(
    db: &DatabaseConnection,
    user_id: i64,
    path: &DavPath,
    root_folder_id: Option<i64>,
) -> Result<(Option<i64>, String), FsError> {
    let segments = path_segments(path);

    if segments.is_empty() {
        return Err(FsError::Forbidden); // 不能操作根目录本身
    }

    let mut current_parent: Option<i64> = root_folder_id;

    for segment in &segments[..segments.len() - 1] {
        let folder = folder_repo::find_by_name_in_parent(db, user_id, current_parent, segment)
            .await
            .map_err(|_| FsError::GeneralFailure)?
            .ok_or(FsError::NotFound)?;
        current_parent = Some(folder.id);
    }

    let last = segments[segments.len() - 1].clone();
    Ok((current_parent, last))
}
