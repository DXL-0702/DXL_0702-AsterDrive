use super::CacheBackend;
use async_trait::async_trait;
use redis::AsyncCommands;

pub struct RedisCache {
    conn: redis::aio::ConnectionManager,
    default_ttl: u64,
}

impl RedisCache {
    pub async fn new(url: &str, default_ttl: u64) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(url)?;
        let conn = redis::aio::ConnectionManager::new(client).await?;
        Ok(Self { conn, default_ttl })
    }
}

#[async_trait]
impl CacheBackend for RedisCache {
    async fn get_bytes(&self, key: &str) -> Option<Vec<u8>> {
        let mut conn = self.conn.clone();
        conn.get(key).await.ok()?
    }

    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl_secs: Option<u64>) {
        let ttl = ttl_secs.unwrap_or(self.default_ttl);
        let mut conn = self.conn.clone();
        let _: Result<(), _> = conn.set_ex(key, value, ttl).await;
    }

    async fn delete(&self, key: &str) {
        let mut conn = self.conn.clone();
        let _: Result<(), _> = conn.del(key).await;
    }

    async fn invalidate_prefix(&self, prefix: &str) {
        let mut conn = self.conn.clone();
        let pattern = format!("{prefix}*");
        let mut cursor: u64 = 0;
        loop {
            let (next_cursor, keys): (u64, Vec<String>) = match redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(&pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut conn)
                .await
            {
                Ok(result) => result,
                Err(_) => break,
            };
            if !keys.is_empty() {
                let _: Result<(), _> = conn.del::<_, ()>(&keys).await;
            }
            cursor = next_cursor;
            if cursor == 0 {
                break;
            }
        }
    }
}
