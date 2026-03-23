use std::io::Cursor;

use image::ImageFormat;

use crate::db::repository::policy_repo;
use crate::entities::file_blob;
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::runtime::AppState;

const THUMB_MAX_DIM: u32 = 200;
const THUMB_PREFIX: &str = "_thumb";

/// 判断 MIME 类型是否支持生成缩略图
pub fn is_supported_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/bmp" | "image/tiff"
    )
}

/// 计算缩略图在存储驱动中的路径
fn thumb_path(blob_hash: &str) -> String {
    format!(
        "{}/{}/{}/{}.webp",
        THUMB_PREFIX,
        &blob_hash[..2],
        &blob_hash[2..4],
        blob_hash
    )
}

/// 获取或生成缩略图，返回 WebP 字节
pub async fn get_or_generate(state: &AppState, blob: &file_blob::Model) -> Result<Vec<u8>> {
    let policy = policy_repo::find_by_id(&state.db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let path = thumb_path(&blob.hash);

    // 已存在 → 直接返回
    if let Ok(data) = driver.get(&path).await {
        return Ok(data);
    }

    // 读取原文件
    let original = driver.get(&blob.storage_path).await?;

    // 生成缩略图
    let webp_bytes = generate_thumbnail(&original)?;

    // 存储（best-effort，存失败也返回已生成的缩略图）
    if let Err(e) = driver.put(&path, &webp_bytes).await {
        tracing::warn!("failed to store thumbnail {path}: {e}");
    }

    Ok(webp_bytes)
}

/// 删除缩略图（blob 物理删除时调用）
pub async fn delete_thumbnail(state: &AppState, blob: &file_blob::Model) -> Result<()> {
    let policy = policy_repo::find_by_id(&state.db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let path = thumb_path(&blob.hash);

    if driver.exists(&path).await.unwrap_or(false) {
        driver.delete(&path).await?;
    }
    Ok(())
}

/// 解码图片 → 缩放 → 编码为 WebP
fn generate_thumbnail(data: &[u8]) -> Result<Vec<u8>> {
    let img = image::load_from_memory(data)
        .map_aster_err_ctx("decode", AsterError::thumbnail_generation_failed)?;

    let thumb = img.thumbnail(THUMB_MAX_DIM, THUMB_MAX_DIM);

    let mut buf = Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, ImageFormat::WebP)
        .map_aster_err_ctx("encode webp", AsterError::thumbnail_generation_failed)?;

    Ok(buf.into_inner())
}
