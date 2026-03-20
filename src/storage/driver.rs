use crate::errors::Result;
use async_trait::async_trait;
use std::time::Duration;
use tokio::io::AsyncRead;

#[derive(Debug, Clone)]
pub struct BlobMetadata {
    pub size: u64,
    pub content_type: Option<String>,
}

#[async_trait]
pub trait StorageDriver: Send + Sync {
    /// 写入文件，返回最终存储路径
    async fn put(&self, path: &str, data: &[u8]) -> Result<String>;

    /// 读取文件全部内容
    async fn get(&self, path: &str) -> Result<Vec<u8>>;

    /// 获取文件流（大文件下载）
    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>>;

    /// 删除文件
    async fn delete(&self, path: &str) -> Result<()>;

    /// 文件是否存在
    async fn exists(&self, path: &str) -> Result<bool>;

    /// 获取文件元信息
    async fn metadata(&self, path: &str) -> Result<BlobMetadata>;

    /// 生成临时访问 URL（本地存储返回 None）
    async fn presigned_url(&self, path: &str, expires: Duration) -> Result<Option<String>>;
}
