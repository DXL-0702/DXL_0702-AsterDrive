mod memory;
mod noop;
mod redis_cache;

use crate::config::CacheConfig;
use async_trait::async_trait;
use serde::{Serialize, de::DeserializeOwned};
use std::sync::Arc;

/// 通用缓存后端 trait（dyn compatible，用 bytes 接口）
#[async_trait]
pub trait CacheBackend: Send + Sync {
    async fn get_bytes(&self, key: &str) -> Option<Vec<u8>>;
    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl_secs: Option<u64>);
    async fn delete(&self, key: &str);
    async fn invalidate_prefix(&self, prefix: &str);
}

/// 便捷扩展方法（自动序列化/反序列化）
pub trait CacheExt {
    fn get<T: DeserializeOwned + Send>(
        &self,
        key: &str,
    ) -> impl std::future::Future<Output = Option<T>> + Send;

    fn set<T: Serialize + Send + Sync>(
        &self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> impl std::future::Future<Output = ()> + Send;
}

impl CacheExt for dyn CacheBackend {
    async fn get<T: DeserializeOwned + Send>(&self, key: &str) -> Option<T> {
        let bytes = self.get_bytes(key).await?;
        serde_json::from_slice(&bytes).ok()
    }

    async fn set<T: Serialize + Send + Sync>(&self, key: &str, value: &T, ttl_secs: Option<u64>) {
        if let Ok(bytes) = serde_json::to_vec(value) {
            self.set_bytes(key, bytes, ttl_secs).await;
        }
    }
}

/// 根据配置创建缓存后端
pub async fn create_cache(config: &CacheConfig) -> Arc<dyn CacheBackend> {
    if !config.enabled {
        tracing::info!("cache disabled");
        return Arc::new(noop::NoopCache);
    }

    match config.backend.as_str() {
        "redis" => {
            match redis_cache::RedisCache::new(&config.redis_url, config.default_ttl).await {
                Ok(cache) => {
                    tracing::info!("cache backend: redis ({})", config.redis_url);
                    Arc::new(cache)
                }
                Err(e) => {
                    tracing::warn!("redis connection failed: {e}, falling back to memory cache");
                    Arc::new(memory::MemoryCache::new(config.default_ttl))
                }
            }
        }
        _ => {
            tracing::info!("cache backend: memory (ttl={}s)", config.default_ttl);
            Arc::new(memory::MemoryCache::new(config.default_ttl))
        }
    }
}
