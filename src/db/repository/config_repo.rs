use crate::entities::system_config::{self, Entity as SystemConfig};
use crate::errors::{AsterError, Result};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

pub async fn find_all(db: &DatabaseConnection) -> Result<Vec<system_config::Model>> {
    SystemConfig::find().all(db).await.map_err(AsterError::from)
}

pub async fn find_by_key(
    db: &DatabaseConnection,
    key: &str,
) -> Result<Option<system_config::Model>> {
    SystemConfig::find()
        .filter(system_config::Column::Key.eq(key))
        .one(db)
        .await
        .map_err(AsterError::from)
}

pub async fn upsert(
    db: &DatabaseConnection,
    key: &str,
    value: &str,
    updated_by: i64,
) -> Result<system_config::Model> {
    let now = Utc::now();
    if let Some(existing) = find_by_key(db, key).await? {
        let mut active: system_config::ActiveModel = existing.into();
        active.value = Set(value.to_string());
        active.updated_at = Set(now);
        active.updated_by = Set(Some(updated_by));
        active.update(db).await.map_err(AsterError::from)
    } else {
        let model = system_config::ActiveModel {
            key: Set(key.to_string()),
            value: Set(value.to_string()),
            updated_at: Set(now),
            updated_by: Set(Some(updated_by)),
            ..Default::default()
        };
        model.insert(db).await.map_err(AsterError::from)
    }
}

pub async fn delete_by_key(db: &DatabaseConnection, key: &str) -> Result<()> {
    let existing = find_by_key(db, key)
        .await?
        .ok_or_else(|| AsterError::record_not_found(format!("config key '{key}'")))?;
    SystemConfig::delete_by_id(existing.id)
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}
