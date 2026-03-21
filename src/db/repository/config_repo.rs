use crate::config::definitions::ALL_CONFIGS;
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
        // 新建的配置默认为 custom
        let model = system_config::ActiveModel {
            key: Set(key.to_string()),
            value: Set(value.to_string()),
            source: Set("custom".to_string()),
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

    // 系统配置不允许删除
    if existing.source == "system" {
        return Err(AsterError::auth_forbidden(
            "cannot delete system configuration",
        ));
    }

    SystemConfig::delete_by_id(existing.id)
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}

/// 确保所有系统配置存在，同步元信息（不覆盖用户修改的 value）
pub async fn ensure_defaults(db: &DatabaseConnection) -> Result<usize> {
    let mut count = 0;

    for def in ALL_CONFIGS {
        let default_value = (def.default_fn)();

        if let Some(existing) = find_by_key(db, def.key).await? {
            // 已存在：同步元信息（不动 value）
            let mut active: system_config::ActiveModel = existing.into();
            active.source = Set("system".to_string());
            active.value_type = Set(def.value_type.to_string());
            active.requires_restart = Set(def.requires_restart);
            active.is_sensitive = Set(def.is_sensitive);
            active.category = Set(def.category.to_string());
            active.description = Set(def.description.to_string());
            active.update(db).await.map_err(AsterError::from)?;
        } else {
            // 不存在：插入默认值
            let now = Utc::now();
            let model = system_config::ActiveModel {
                key: Set(def.key.to_string()),
                value: Set(default_value),
                value_type: Set(def.value_type.to_string()),
                requires_restart: Set(def.requires_restart),
                is_sensitive: Set(def.is_sensitive),
                source: Set("system".to_string()),
                namespace: Set(String::new()),
                category: Set(def.category.to_string()),
                description: Set(def.description.to_string()),
                updated_at: Set(now),
                updated_by: Set(None),
                ..Default::default()
            };
            model.insert(db).await.map_err(AsterError::from)?;
            tracing::debug!("initialized config '{}' with default value", def.key);
            count += 1;
        }
    }

    if count > 0 {
        tracing::info!("initialized {count} default configuration items");
    }

    Ok(count)
}
