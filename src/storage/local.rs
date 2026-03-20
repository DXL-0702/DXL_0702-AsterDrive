use super::driver::{BlobMetadata, StorageDriver};
use crate::entities::storage_policy;
use crate::errors::{AsterError, Result};
use async_trait::async_trait;
use std::path::PathBuf;
use std::time::Duration;
use tokio::io::AsyncRead;

pub struct LocalDriver {
    base_path: PathBuf,
}

impl LocalDriver {
    pub fn new(policy: &storage_policy::Model) -> Result<Self> {
        let base = if policy.base_path.is_empty() {
            PathBuf::from("./data")
        } else {
            PathBuf::from(&policy.base_path)
        };
        Ok(Self { base_path: base })
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
                .map_err(|e| AsterError::storage_driver_error(e.to_string()))?;
        }
        tokio::fs::write(&full, data)
            .await
            .map_err(|e| AsterError::storage_driver_error(e.to_string()))?;
        Ok(path.to_string())
    }

    async fn get(&self, path: &str) -> Result<Vec<u8>> {
        tokio::fs::read(self.full_path(path))
            .await
            .map_err(|e| AsterError::storage_driver_error(e.to_string()))
    }

    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>> {
        let file = tokio::fs::File::open(self.full_path(path))
            .await
            .map_err(|e| AsterError::storage_driver_error(e.to_string()))?;
        Ok(Box::new(file))
    }

    async fn delete(&self, path: &str) -> Result<()> {
        tokio::fs::remove_file(self.full_path(path))
            .await
            .map_err(|e| AsterError::storage_driver_error(e.to_string()))
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        Ok(self.full_path(path).exists())
    }

    async fn metadata(&self, path: &str) -> Result<BlobMetadata> {
        let meta = tokio::fs::metadata(self.full_path(path))
            .await
            .map_err(|e| AsterError::storage_driver_error(e.to_string()))?;
        Ok(BlobMetadata {
            size: meta.len(),
            content_type: None,
        })
    }

    async fn presigned_url(&self, _path: &str, _expires: Duration) -> Result<Option<String>> {
        Ok(None)
    }
}
