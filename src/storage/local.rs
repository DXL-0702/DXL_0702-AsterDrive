use super::driver::{BlobMetadata, StorageDriver};
use crate::entities::storage_policy;
use crate::errors::{AsterError, MapAsterErr, Result};
use async_trait::async_trait;
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::AsyncRead;

pub struct LocalDriver {
    base_path: PathBuf,
}

pub fn effective_base_path(policy: &storage_policy::Model) -> PathBuf {
    if policy.base_path.is_empty() {
        PathBuf::from("./data")
    } else {
        PathBuf::from(&policy.base_path)
    }
}

pub fn upload_staging_path(policy: &storage_policy::Model, name: &str) -> PathBuf {
    effective_base_path(policy)
        .join(".staging")
        .join(name.trim_start_matches('/'))
}

impl LocalDriver {
    pub fn new(policy: &storage_policy::Model) -> Result<Self> {
        Ok(Self {
            base_path: effective_base_path(policy),
        })
    }

    fn full_path(&self, path: &str) -> PathBuf {
        self.base_path.join(path.trim_start_matches('/'))
    }
}

#[async_trait]
impl StorageDriver for LocalDriver {
    async fn put(&self, path: &str, data: &[u8]) -> Result<String> {
        let full = self.full_path(path);
        if let Some(parent) = full.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_aster_err(AsterError::storage_driver_error)?;
        }
        tokio::fs::write(&full, data)
            .await
            .map_aster_err(AsterError::storage_driver_error)?;
        Ok(path.to_string())
    }

    async fn get(&self, path: &str) -> Result<Vec<u8>> {
        tokio::fs::read(self.full_path(path))
            .await
            .map_aster_err(AsterError::storage_driver_error)
    }

    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>> {
        let file = tokio::fs::File::open(self.full_path(path))
            .await
            .map_aster_err(AsterError::storage_driver_error)?;
        Ok(Box::new(file))
    }

    async fn delete(&self, path: &str) -> Result<()> {
        tokio::fs::remove_file(self.full_path(path))
            .await
            .map_aster_err(AsterError::storage_driver_error)
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        Ok(self.full_path(path).exists())
    }

    async fn metadata(&self, path: &str) -> Result<BlobMetadata> {
        let meta = tokio::fs::metadata(self.full_path(path))
            .await
            .map_aster_err(AsterError::storage_driver_error)?;
        Ok(BlobMetadata {
            size: meta.len(),
            content_type: None,
        })
    }

    async fn put_file(&self, storage_path: &str, local_path: &str) -> Result<String> {
        let full = self.full_path(storage_path);
        if let Some(parent) = full.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_aster_err(AsterError::storage_driver_error)?;
        }
        // rename 是零拷贝（同一文件系统），跨文件系统 fallback 到 copy + delete
        if tokio::fs::rename(local_path, &full).await.is_err() {
            tokio::fs::copy(local_path, &full)
                .await
                .map_aster_err_ctx("copy file", AsterError::storage_driver_error)?;
            let _ = tokio::fs::remove_file(local_path).await;
        }
        Ok(storage_path.to_string())
    }

    async fn presigned_url(&self, _path: &str, _expires: Duration) -> Result<Option<String>> {
        Ok(None)
    }
}
