use sea_orm::DatabaseConnection;

use crate::db::repository::config_repo;
use crate::entities::system_config;
use crate::errors::{AsterError, Result};

pub async fn list_all(db: &DatabaseConnection) -> Result<Vec<system_config::Model>> {
    config_repo::find_all(db).await
}

pub async fn get_by_key(db: &DatabaseConnection, key: &str) -> Result<system_config::Model> {
    config_repo::find_by_key(db, key)
        .await?
        .ok_or_else(|| AsterError::record_not_found(format!("config key '{key}'")))
}

pub async fn set(
    db: &DatabaseConnection,
    key: &str,
    value: &str,
    updated_by: i64,
) -> Result<system_config::Model> {
    config_repo::upsert(db, key, value, updated_by).await
}

pub async fn delete(db: &DatabaseConnection, key: &str) -> Result<()> {
    config_repo::delete_by_key(db, key).await
}
