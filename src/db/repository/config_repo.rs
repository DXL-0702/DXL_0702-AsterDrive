use crate::config::definitions::ALL_CONFIGS;
use crate::entities::system_config::{self, Entity as SystemConfig};
use crate::errors::{AsterError, Result};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, InsertResult, QueryFilter, Set,
};

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

/// 确保所有配置项存在，不存在则使用默认值初始化（ON CONFLICT DO NOTHING）
pub async fn ensure_defaults(db: &DatabaseConnection) -> Result<usize> {
    let mut inserted = 0;

    for def in ALL_CONFIGS {
        let default_value = (def.default_fn)();
        if insert_if_not_exists(db, def, &default_value).await? {
            tracing::debug!("initialized config '{}' with default value", def.key);
            inserted += 1;
        }
    }

    if inserted > 0 {
        tracing::info!("initialized {inserted} default configuration items");
    }

    Ok(inserted)
}

/// 原子性插入：已存在则跳过
async fn insert_if_not_exists(
    db: &DatabaseConnection,
    def: &crate::config::definitions::ConfigDef,
    value: &str,
) -> Result<bool> {
    use sea_orm::sea_query::OnConflict;

    let now = Utc::now();
    let model = system_config::ActiveModel {
        key: Set(def.key.to_string()),
        value: Set(value.to_string()),
        value_type: Set(def.value_type.to_string()),
        requires_restart: Set(def.requires_restart),
        is_sensitive: Set(def.is_sensitive),
        updated_at: Set(now),
        updated_by: Set(None),
        ..Default::default()
    };

    let result: std::result::Result<InsertResult<system_config::ActiveModel>, sea_orm::DbErr> =
        SystemConfig::insert(model)
            .on_conflict(
                OnConflict::column(system_config::Column::Key)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(db)
            .await;

    match result {
        Ok(_) => Ok(true),
        Err(sea_orm::DbErr::RecordNotInserted) => Ok(false),
        Err(e) => {
            let err_str = e.to_string().to_lowercase();
            if err_str.contains("no rows") || err_str.contains("record not inserted") {
                Ok(false)
            } else {
                Err(AsterError::from(e))
            }
        }
    }
}
