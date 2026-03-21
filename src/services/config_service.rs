use crate::db::repository::config_repo;
use crate::entities::system_config;
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;

pub async fn list_all(state: &AppState) -> Result<Vec<system_config::Model>> {
    config_repo::find_all(&state.db).await
}

pub async fn get_by_key(state: &AppState, key: &str) -> Result<system_config::Model> {
    config_repo::find_by_key(&state.db, key)
        .await?
        .ok_or_else(|| AsterError::record_not_found(format!("config key '{key}'")))
}

pub async fn set(
    state: &AppState,
    key: &str,
    value: &str,
    updated_by: i64,
) -> Result<system_config::Model> {
    config_repo::upsert(&state.db, key, value, updated_by).await
}

pub async fn delete(state: &AppState, key: &str) -> Result<()> {
    config_repo::delete_by_key(&state.db, key).await
}
