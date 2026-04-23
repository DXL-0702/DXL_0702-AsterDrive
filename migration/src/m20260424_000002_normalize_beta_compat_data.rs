//! 数据库迁移：统一清理 beta 前移除的兼容数据。

use sea_orm::{ConnectionTrait, DbBackend, Statement};
use sea_orm_migration::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::io::Cursor;

#[derive(DeriveMigrationName)]
pub struct Migration;

const PREVIEW_APPS_CONFIG_KEY: &str = "frontend_preview_apps_json";
const PREVIEW_APP_DISCOVERY_GENERATED_SEGMENT: &str = "__wopi_discovery__";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum LockOwnerInfo {
    Wopi { app_key: String, lock: String },
    Webdav { xml: String },
    Text { value: String },
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        normalize_remote_upload_strategy(manager).await?;
        normalize_resource_lock_owner_info(manager).await?;
        remove_legacy_wopi_preview_seed_apps(manager).await?;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}

async fn normalize_remote_upload_strategy(manager: &SchemaManager<'_>) -> Result<(), DbErr> {
    let db = manager.get_connection();
    let backend = db.get_database_backend();
    let rows = db
        .query_all_raw(Statement::from_string(
            backend,
            "SELECT id, options FROM storage_policies".to_string(),
        ))
        .await?;

    for row in rows {
        let id = row
            .try_get_by_index::<i64>(0)
            .map_err(|error| DbErr::Migration(format!("read storage_policies.id: {error}")))?;
        let raw = row.try_get_by_index::<String>(1).map_err(|error| {
            DbErr::Migration(format!("read storage_policies.options for #{id}: {error}"))
        })?;

        let Some(normalized) = normalize_remote_upload_strategy_value(&raw)? else {
            continue;
        };

        db.execute_raw(Statement::from_sql_and_values(
            backend,
            "UPDATE storage_policies SET options = ? WHERE id = ?",
            vec![normalized.into(), id.into()],
        ))
        .await?;
    }

    Ok(())
}

async fn normalize_resource_lock_owner_info(manager: &SchemaManager<'_>) -> Result<(), DbErr> {
    let db = manager.get_connection();
    let backend = db.get_database_backend();
    let rows = db
        .query_all_raw(Statement::from_string(
            backend,
            "SELECT id, owner_info FROM resource_locks WHERE owner_info IS NOT NULL".to_string(),
        ))
        .await?;

    for row in rows {
        let id = row
            .try_get_by_index::<i64>(0)
            .map_err(|error| DbErr::Migration(format!("read resource_locks.id: {error}")))?;
        let raw = row.try_get_by_index::<String>(1).map_err(|error| {
            DbErr::Migration(format!("read resource_locks.owner_info for #{id}: {error}"))
        })?;
        let normalized = normalize_lock_owner_info_value(&raw)?;

        if normalized == raw {
            continue;
        }

        db.execute_raw(Statement::from_sql_and_values(
            backend,
            "UPDATE resource_locks SET owner_info = ? WHERE id = ?",
            vec![normalized.into(), id.into()],
        ))
        .await?;
    }

    Ok(())
}

async fn remove_legacy_wopi_preview_seed_apps(manager: &SchemaManager<'_>) -> Result<(), DbErr> {
    let db = manager.get_connection();
    let backend = db.get_database_backend();
    let key_ident = quote_ident(backend, "key");
    let rows = db
        .query_all_raw(Statement::from_sql_and_values(
            backend,
            format!("SELECT id, value FROM system_config WHERE {key_ident} = ?"),
            vec![PREVIEW_APPS_CONFIG_KEY.into()],
        ))
        .await?;

    for row in rows {
        let id = row
            .try_get_by_index::<i64>(0)
            .map_err(|error| DbErr::Migration(format!("read system_config.id: {error}")))?;
        let raw = row.try_get_by_index::<String>(1).map_err(|error| {
            DbErr::Migration(format!(
                "read system_config.value for preview apps config #{id}: {error}"
            ))
        })?;
        let Some(normalized) = remove_legacy_seed_apps_value(&raw)? else {
            continue;
        };

        db.execute_raw(Statement::from_sql_and_values(
            backend,
            "UPDATE system_config SET value = ? WHERE id = ?",
            vec![normalized.into(), id.into()],
        ))
        .await?;
    }

    Ok(())
}

fn normalize_remote_upload_strategy_value(raw: &str) -> Result<Option<String>, DbErr> {
    let Ok(mut value) = serde_json::from_str::<JsonValue>(raw) else {
        return Ok(None);
    };
    let Some(object) = value.as_object_mut() else {
        return Ok(None);
    };
    let Some(strategy) = object.get_mut("remote_upload_strategy") else {
        return Ok(None);
    };
    if strategy.as_str() != Some("chunked") {
        return Ok(None);
    }

    *strategy = JsonValue::String("presigned".to_string());
    serde_json::to_string(&value).map(Some).map_err(|error| {
        DbErr::Migration(format!(
            "serialize normalized storage policy options: {error}"
        ))
    })
}

fn normalize_lock_owner_info_value(raw: &str) -> Result<String, DbErr> {
    if let Ok(payload) = serde_json::from_str::<LockOwnerInfo>(raw) {
        return serde_json::to_string(&payload).map_err(|error| {
            DbErr::Migration(format!(
                "serialize canonical resource lock owner JSON: {error}"
            ))
        });
    }

    let payload = if xmltree::Element::parse(Cursor::new(raw.as_bytes())).is_ok() {
        LockOwnerInfo::Webdav {
            xml: raw.to_string(),
        }
    } else {
        LockOwnerInfo::Text {
            value: raw.to_string(),
        }
    };

    serde_json::to_string(&payload).map_err(|error| {
        DbErr::Migration(format!(
            "serialize normalized resource lock owner JSON: {error}"
        ))
    })
}

fn remove_legacy_seed_apps_value(raw: &str) -> Result<Option<String>, DbErr> {
    let Ok(mut value) = serde_json::from_str::<JsonValue>(raw) else {
        return Ok(None);
    };
    let Some(apps) = value.get_mut("apps").and_then(JsonValue::as_array_mut) else {
        return Ok(None);
    };

    let original_len = apps.len();
    apps.retain(|app| !is_legacy_wopi_seed_app(app));

    if apps.len() == original_len || apps.is_empty() {
        return Ok(None);
    }

    serde_json::to_string(&value).map(Some).map_err(|error| {
        DbErr::Migration(format!("serialize normalized preview apps config: {error}"))
    })
}

fn is_legacy_wopi_seed_app(app: &JsonValue) -> bool {
    let Some(object) = app.as_object() else {
        return false;
    };

    let key = object
        .get("key")
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .unwrap_or_default();
    let provider = object
        .get("provider")
        .and_then(JsonValue::as_str)
        .map(str::trim)
        .unwrap_or_default();
    let extensions_empty = object
        .get("extensions")
        .and_then(JsonValue::as_array)
        .map_or(true, Vec::is_empty);
    let Some(config) = object.get("config").and_then(JsonValue::as_object) else {
        return false;
    };

    provider.eq_ignore_ascii_case("wopi")
        && !key.contains(PREVIEW_APP_DISCOVERY_GENERATED_SEGMENT)
        && key.starts_with("custom.wopi.")
        && extensions_empty
        && config
            .get("discovery_url")
            .and_then(JsonValue::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        && !config
            .get("action")
            .and_then(JsonValue::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        && !config
            .get("action_url")
            .and_then(JsonValue::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        && !config
            .get("action_url_template")
            .and_then(JsonValue::as_str)
            .is_some_and(|value| !value.trim().is_empty())
}

fn quote_ident(backend: DbBackend, ident: &str) -> String {
    match backend {
        DbBackend::MySql => format!("`{}`", ident.replace('`', "``")),
        DbBackend::Postgres | DbBackend::Sqlite => {
            format!("\"{}\"", ident.replace('"', "\"\""))
        }
        _ => format!("\"{}\"", ident.replace('"', "\"\"")),
    }
}
