use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};

use crate::config::system_config as shared_system_config;
use crate::db;
use crate::db::repository::config_repo;
use crate::entities::system_config;
use crate::errors::{AsterError, Result};
use crate::services::config_service::SystemConfig;
use chrono::Utc;
use clap::builder::styling::{AnsiColor, Effects, Styles};
use clap::{Args, Subcommand, ValueEnum};
use sea_orm::TransactionTrait;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum OutputFormat {
    Json,
    PrettyJson,
}

#[derive(Debug, Clone, Subcommand)]
pub enum ConfigCommand {
    /// List runtime config entries
    List,
    /// Get a runtime config entry
    Get(KeyArgs),
    /// Set a runtime config entry
    Set(KeyValueArgs),
    /// Delete a custom runtime config entry
    Delete(KeyArgs),
    /// Validate runtime config input without writing it
    Validate(ValidateArgs),
    /// Export runtime config entries
    Export,
    /// Import runtime config entries
    Import(FileArgs),
}

#[derive(Debug, Clone, Args)]
pub struct KeyArgs {
    #[arg(long, env = "ASTER_CLI_CONFIG_KEY")]
    pub key: String,
}

#[derive(Debug, Clone, Args)]
pub struct KeyValueArgs {
    #[arg(long, env = "ASTER_CLI_CONFIG_KEY")]
    pub key: String,
    #[arg(long, env = "ASTER_CLI_CONFIG_VALUE")]
    pub value: String,
}

#[derive(Debug, Clone, Args)]
pub struct FileArgs {
    #[arg(long, env = "ASTER_CLI_INPUT_FILE")]
    pub input_file: PathBuf,
}

#[derive(Debug, Clone, Args)]
pub struct ValidateArgs {
    #[arg(long, env = "ASTER_CLI_CONFIG_KEY")]
    pub key: Option<String>,
    #[arg(long, env = "ASTER_CLI_CONFIG_VALUE")]
    pub value: Option<String>,
    #[arg(long, env = "ASTER_CLI_INPUT_FILE")]
    pub input_file: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
pub struct SuccessEnvelope<T> {
    pub ok: bool,
    pub data: T,
}

#[derive(Debug, Serialize)]
pub struct ErrorEnvelope<'a> {
    pub ok: bool,
    pub error: ErrorPayload<'a>,
}

#[derive(Debug, Serialize)]
pub struct ErrorPayload<'a> {
    pub code: &'a str,
    pub error_type: &'a str,
    pub message: &'a str,
}

#[derive(Debug, Serialize)]
struct ConfigListOutput {
    count: usize,
    configs: Vec<SystemConfig>,
}

#[derive(Debug, Serialize)]
struct DeleteOutput {
    key: String,
    deleted: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ImportItem {
    key: String,
    value: String,
}

#[derive(Debug, Deserialize)]
struct ImportFilePayload {
    configs: Vec<ImportItem>,
}

pub async fn execute_config_command(
    database_url: &str,
    command: &ConfigCommand,
) -> Result<serde_json::Value> {
    let db = connect_database(database_url).await?;

    match command {
        ConfigCommand::List | ConfigCommand::Export => {
            let configs = load_config_views(&db).await?;
            to_json_value(ConfigListOutput {
                count: configs.len(),
                configs,
            })
        }
        ConfigCommand::Get(args) => {
            let config = config_repo::find_by_key(&db, &args.key)
                .await?
                .map(system_config_to_view)
                .ok_or_else(|| {
                    AsterError::record_not_found(format!("config key '{}'", args.key))
                })?;
            to_json_value(config)
        }
        ConfigCommand::Set(args) => {
            let normalized = normalize_entries(
                build_value_lookup(&config_repo::find_all(&db).await?),
                &[ImportItem {
                    key: args.key.clone(),
                    value: args.value.clone(),
                }],
            )?;
            let normalized_item = normalized
                .into_iter()
                .next()
                .expect("single entry normalization should return one item");
            let saved = config_repo::upsert_with_actor(
                &db,
                &normalized_item.key,
                &normalized_item.value,
                None,
            )
            .await?;
            to_json_value(system_config_to_view(saved))
        }
        ConfigCommand::Delete(args) => {
            config_repo::delete_by_key(&db, &args.key).await?;
            to_json_value(DeleteOutput {
                key: args.key.clone(),
                deleted: true,
            })
        }
        ConfigCommand::Validate(args) => {
            let entries = resolve_validate_entries(args)?;
            let current_lookup = build_value_lookup(&config_repo::find_all(&db).await?);
            let normalized = normalize_entries(current_lookup, &entries)?;
            let previews: Vec<SystemConfig> = normalized
                .into_iter()
                .map(|item| preview_system_config(&item.key, &item.value))
                .collect();
            to_json_value(ConfigListOutput {
                count: previews.len(),
                configs: previews,
            })
        }
        ConfigCommand::Import(args) => {
            let entries = read_import_items(&args.input_file)?;
            let txn = db.begin().await.map_err(AsterError::from)?;
            let current_lookup = build_value_lookup(&config_repo::find_all(&txn).await?);
            let normalized = normalize_entries(current_lookup, &entries)?;
            let mut saved = Vec::with_capacity(normalized.len());
            for item in normalized {
                let model =
                    config_repo::upsert_with_actor(&txn, &item.key, &item.value, None).await?;
                saved.push(system_config_to_view(model));
            }
            txn.commit().await.map_err(AsterError::from)?;
            to_json_value(ConfigListOutput {
                count: saved.len(),
                configs: saved,
            })
        }
    }
}

pub fn render_success<T>(format: OutputFormat, data: &T) -> String
where
    T: Serialize,
{
    let envelope = SuccessEnvelope { ok: true, data };
    match format {
        OutputFormat::Json => {
            serde_json::to_string(&envelope).expect("success envelope to serialize")
        }
        OutputFormat::PrettyJson => {
            serde_json::to_string_pretty(&envelope).expect("success envelope to serialize")
        }
    }
}

pub fn render_error(format: OutputFormat, err: &AsterError) -> String {
    let envelope = ErrorEnvelope {
        ok: false,
        error: ErrorPayload {
            code: err.code(),
            error_type: err.error_type(),
            message: err.message(),
        },
    };
    match format {
        OutputFormat::Json => {
            serde_json::to_string(&envelope).expect("error envelope to serialize")
        }
        OutputFormat::PrettyJson => {
            serde_json::to_string_pretty(&envelope).expect("error envelope to serialize")
        }
    }
}

pub fn cli_styles() -> Styles {
    Styles::styled()
        .header(AnsiColor::Green.on_default() | Effects::BOLD)
        .usage(AnsiColor::Green.on_default() | Effects::BOLD)
        .literal(AnsiColor::Cyan.on_default() | Effects::BOLD)
        .placeholder(AnsiColor::Yellow.on_default())
}

async fn connect_database(database_url: &str) -> Result<sea_orm::DatabaseConnection> {
    let db = db::connect(&crate::config::DatabaseConfig {
        url: database_url.to_string(),
        pool_size: 1,
        retry_count: 0,
    })
    .await?;
    config_repo::ensure_defaults(&db).await?;
    Ok(db)
}

async fn load_config_views(db: &sea_orm::DatabaseConnection) -> Result<Vec<SystemConfig>> {
    Ok(config_repo::find_all(db)
        .await?
        .into_iter()
        .map(system_config_to_view)
        .collect())
}

fn system_config_to_view(model: system_config::Model) -> SystemConfig {
    shared_system_config::apply_definition(model).into()
}

fn build_value_lookup(models: &[system_config::Model]) -> HashMap<String, String> {
    models
        .iter()
        .map(|model| (model.key.clone(), model.value.clone()))
        .collect()
}

fn normalize_entries(
    mut current_lookup: HashMap<String, String>,
    entries: &[ImportItem],
) -> Result<Vec<ImportItem>> {
    let mut seen_keys = BTreeSet::new();
    for entry in entries {
        if !seen_keys.insert(entry.key.clone()) {
            return Err(AsterError::validation_error(format!(
                "duplicate config key '{}' in input",
                entry.key
            )));
        }
        current_lookup.insert(entry.key.clone(), entry.value.clone());
    }

    for entry in entries {
        if let Some(def) = shared_system_config::get_definition(&entry.key) {
            shared_system_config::validate_value_type(def.value_type, &entry.value)?;
        }
    }

    entries
        .iter()
        .map(|entry| {
            let value = if shared_system_config::get_definition(&entry.key).is_some() {
                shared_system_config::normalize_system_value(
                    &current_lookup,
                    &entry.key,
                    &entry.value,
                )?
            } else {
                entry.value.clone()
            };

            Ok(ImportItem {
                key: entry.key.clone(),
                value,
            })
        })
        .collect()
}

fn resolve_validate_entries(args: &ValidateArgs) -> Result<Vec<ImportItem>> {
    match (&args.input_file, &args.key, &args.value) {
        (Some(path), None, None) => read_import_items(path),
        (None, Some(key), Some(value)) => Ok(vec![ImportItem {
            key: key.clone(),
            value: value.clone(),
        }]),
        (Some(_), Some(_), _) | (Some(_), _, Some(_)) => Err(AsterError::validation_error(
            "validate accepts either ASTER_CLI_INPUT_FILE or ASTER_CLI_CONFIG_KEY + ASTER_CLI_CONFIG_VALUE",
        )),
        _ => Err(AsterError::validation_error(
            "validate requires ASTER_CLI_INPUT_FILE or ASTER_CLI_CONFIG_KEY + ASTER_CLI_CONFIG_VALUE",
        )),
    }
}

fn read_import_items(path: &Path) -> Result<Vec<ImportItem>> {
    let content = std::fs::read_to_string(path).map_err(|error| {
        AsterError::config_error(format!(
            "failed to read input file '{}': {error}",
            path.display()
        ))
    })?;

    if let Ok(items) = serde_json::from_str::<Vec<ImportItem>>(&content) {
        return Ok(items);
    }

    let payload = serde_json::from_str::<ImportFilePayload>(&content).map_err(|error| {
        AsterError::validation_error(format!(
            "input file '{}' must be a JSON array or {{\"configs\": [...]}} payload: {error}",
            path.display()
        ))
    })?;
    Ok(payload.configs)
}

fn preview_system_config(key: &str, value: &str) -> SystemConfig {
    let model = if let Some(def) = shared_system_config::get_definition(key) {
        system_config::Model {
            id: 0,
            key: key.to_string(),
            value: value.to_string(),
            value_type: def.value_type.to_string(),
            requires_restart: def.requires_restart,
            is_sensitive: def.is_sensitive,
            source: "system".to_string(),
            namespace: String::new(),
            category: def.category.to_string(),
            description: def.description.to_string(),
            updated_at: Utc::now(),
            updated_by: None,
        }
    } else {
        system_config::Model {
            id: 0,
            key: key.to_string(),
            value: value.to_string(),
            value_type: "string".to_string(),
            requires_restart: false,
            is_sensitive: false,
            source: "custom".to_string(),
            namespace: String::new(),
            category: String::new(),
            description: String::new(),
            updated_at: Utc::now(),
            updated_by: None,
        }
    };

    system_config_to_view(model)
}

fn to_json_value<T>(value: T) -> Result<serde_json::Value>
where
    T: Serialize,
{
    serde_json::to_value(value).map_err(|error| {
        AsterError::internal_error(format!("failed to serialize CLI output: {error}"))
    })
}
