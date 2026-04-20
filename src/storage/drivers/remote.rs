//! 存储驱动实现：`remote`。

use crate::entities::{managed_follower, storage_policy};
use crate::errors::{AsterError, Result};
use crate::storage::driver::{BlobMetadata, StorageDriver};
use crate::storage::extensions::{ListStorageDriver, StreamUploadDriver};
use crate::storage::remote_protocol::RemoteStorageClient;
use async_trait::async_trait;
use std::path::Path;
use tokio::io::AsyncRead;

pub struct RemoteDriver {
    client: RemoteStorageClient,
    base_path: String,
}

impl RemoteDriver {
    pub fn new(policy: &storage_policy::Model, follower: &managed_follower::Model) -> Result<Self> {
        if follower.namespace.trim().is_empty() {
            return Err(AsterError::storage_driver_error(
                "remote node namespace cannot be empty",
            ));
        }
        Ok(Self {
            client: RemoteStorageClient::new(
                &follower.base_url,
                &follower.access_key,
                &follower.secret_key,
            )?,
            base_path: policy.base_path.trim_matches('/').to_string(),
        })
    }

    fn object_key(&self, path: &str) -> String {
        let path = path.trim_start_matches('/');
        if self.base_path.is_empty() {
            path.to_string()
        } else if path.is_empty() {
            self.base_path.clone()
        } else {
            format!("{}/{}", self.base_path, path)
        }
    }

    fn strip_base_path<'a>(&self, object_key: &'a str) -> Option<&'a str> {
        if self.base_path.is_empty() {
            return Some(object_key.trim_start_matches('/'));
        }

        object_key
            .strip_prefix(&self.base_path)
            .map(|suffix| suffix.trim_start_matches('/'))
            .or_else(|| (object_key == self.base_path).then_some(""))
    }
}

#[async_trait]
impl StorageDriver for RemoteDriver {
    async fn put(&self, path: &str, data: &[u8]) -> Result<String> {
        self.client.put_bytes(&self.object_key(path), data).await?;
        Ok(path.to_string())
    }

    async fn get(&self, path: &str) -> Result<Vec<u8>> {
        self.client.get_bytes(&self.object_key(path)).await
    }

    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>> {
        self.client
            .get_stream(&self.object_key(path), None, None)
            .await
    }

    async fn get_range(
        &self,
        path: &str,
        offset: u64,
        length: Option<u64>,
    ) -> Result<Box<dyn AsyncRead + Unpin + Send>> {
        self.client
            .get_stream(&self.object_key(path), Some(offset), length)
            .await
    }

    async fn delete(&self, path: &str) -> Result<()> {
        self.client.delete(&self.object_key(path)).await
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        self.client.exists(&self.object_key(path)).await
    }

    async fn metadata(&self, path: &str) -> Result<BlobMetadata> {
        self.client.metadata(&self.object_key(path)).await
    }

    fn as_list(&self) -> Option<&dyn ListStorageDriver> {
        Some(self)
    }

    fn as_stream_upload(&self) -> Option<&dyn StreamUploadDriver> {
        Some(self)
    }
}

#[async_trait]
impl ListStorageDriver for RemoteDriver {
    async fn list_paths(&self, prefix: Option<&str>) -> Result<Vec<String>> {
        let full_prefix = prefix.map(|value| self.object_key(value));
        let paths = self.client.list_paths(full_prefix.as_deref()).await?;
        Ok(paths
            .into_iter()
            .filter_map(|path| self.strip_base_path(&path).map(str::to_string))
            .collect())
    }
}

#[async_trait]
impl StreamUploadDriver for RemoteDriver {
    async fn put_reader(
        &self,
        storage_path: &str,
        reader: Box<dyn AsyncRead + Unpin + Send + Sync>,
        size: i64,
    ) -> Result<String> {
        let size = u64::try_from(size).map_err(|_| {
            AsterError::storage_driver_error(format!(
                "remote stream upload size must be non-negative, got {size}"
            ))
        })?;
        self.client
            .put_reader(&self.object_key(storage_path), reader, size)
            .await?;
        Ok(storage_path.to_string())
    }

    async fn put_file(&self, storage_path: &str, local_path: &str) -> Result<String> {
        let metadata = tokio::fs::metadata(local_path).await.map_err(|e| {
            AsterError::storage_driver_error(format!("remote put_file metadata: {e}"))
        })?;
        let file = tokio::fs::File::open(Path::new(local_path))
            .await
            .map_err(|e| AsterError::storage_driver_error(format!("remote put_file open: {e}")))?;
        self.put_reader(
            storage_path,
            Box::new(file),
            i64::try_from(metadata.len()).map_err(|_| {
                AsterError::storage_driver_error("remote put_file size exceeds i64 range")
            })?,
        )
        .await
    }
}
