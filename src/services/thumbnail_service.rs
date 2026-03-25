use std::collections::HashSet;
use std::io::Cursor;
use std::sync::Arc;

use image::ImageFormat;
use tokio::sync::{Mutex, mpsc};

use crate::db::repository::{file_repo, policy_repo};
use crate::entities::file_blob;
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::runtime::AppState;
use crate::storage::DriverRegistry;

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

/// 尝试获取已有缩略图，如果不存在则入队后台生成并返回 None
pub async fn get_or_enqueue(state: &AppState, blob: &file_blob::Model) -> Result<Option<Vec<u8>>> {
    let policy = policy_repo::find_by_id(&state.db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let path = thumb_path(&blob.hash);

    // 已存在 → 直接返回
    if let Ok(data) = driver.get(&path).await {
        return Ok(Some(data));
    }

    // 入队后台生成（非阻塞，队列满时 drop）
    let _ = state.thumbnail_tx.try_send(blob.id);

    Ok(None)
}

/// 获取或同步生成缩略图（仅用于公开分享等无法等待的场景）
pub async fn get_or_generate(state: &AppState, blob: &file_blob::Model) -> Result<Vec<u8>> {
    let policy = policy_repo::find_by_id(&state.db, blob.policy_id).await?;
    let driver = state.driver_registry.get_driver(&policy)?;
    let path = thumb_path(&blob.hash);

    // 已存在 → 直接返回
    if let Ok(data) = driver.get(&path).await {
        return Ok(data);
    }

    // 同步生成
    let original = driver.get(&blob.storage_path).await?;
    let webp_bytes = generate_thumbnail(&original)?;

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

/// 启动后台缩略图 worker（单 worker，顺序处理，panic-safe）
pub fn spawn_worker(
    db: actix_web::web::Data<sea_orm::DatabaseConnection>,
    driver_registry: Arc<DriverRegistry>,
    mut rx: mpsc::Receiver<i64>,
) {
    // 去重集合：避免同一 blob 被重复处理
    let pending = Arc::new(Mutex::new(HashSet::<i64>::new()));

    tokio::spawn(async move {
        tracing::info!("thumbnail worker started");

        while let Some(blob_id) = rx.recv().await {
            // 去重检查
            {
                let mut set = pending.lock().await;
                if set.contains(&blob_id) {
                    continue;
                }
                set.insert(blob_id);
            }

            let db = db.clone();
            let registry = driver_registry.clone();
            let pending_inner = pending.clone();

            // 每个任务在子 spawn 中运行，panic 不会杀死 worker
            let handle = tokio::spawn(async move {
                if let Err(e) = process_one_thumbnail(&db, &registry, blob_id).await {
                    tracing::warn!("thumbnail generation failed for blob #{blob_id}: {e}");
                }
                // 处理完移除去重记录
                pending_inner.lock().await.remove(&blob_id);
            });

            // 等待完成（顺序处理，控制内存并发）
            if let Err(e) = handle.await {
                tracing::error!("thumbnail worker task panicked for blob #{blob_id}: {e}");
                pending.lock().await.remove(&blob_id);
            }
        }

        tracing::info!("thumbnail worker stopped");
    });
}

/// 处理单个 blob 的缩略图生成
async fn process_one_thumbnail(
    db: &sea_orm::DatabaseConnection,
    driver_registry: &DriverRegistry,
    blob_id: i64,
) -> Result<()> {
    let blob = file_repo::find_blob_by_id(db, blob_id).await?;
    let policy = policy_repo::find_by_id(db, blob.policy_id).await?;
    let driver = driver_registry.get_driver(&policy)?;
    let path = thumb_path(&blob.hash);

    // 再次检查（可能已由其他路径生成）
    if driver.exists(&path).await.unwrap_or(false) {
        return Ok(());
    }

    // 读取原文件 + 生成缩略图
    let original = driver.get(&blob.storage_path).await?;
    let webp_bytes = generate_thumbnail(&original)?;

    driver.put(&path, &webp_bytes).await?;

    tracing::debug!("thumbnail generated for blob #{blob_id}");
    Ok(())
}
