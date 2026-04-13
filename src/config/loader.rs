use super::schema::Config;
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::utils::paths::{
    DEFAULT_CONFIG_PATH, DEFAULT_CONFIG_SQLITE_DATABASE_URL, DEFAULT_SQLITE_DATABASE_PATH,
    DEFAULT_SQLITE_DATABASE_URL, LEGACY_CONFIG_PATH, LEGACY_SQLITE_DATABASE_PATH,
    resolve_config_relative_path, resolve_config_relative_sqlite_url,
};
use config::{Config as RawConfig, Environment, File};
use serde::Deserialize;
use std::ffi::OsString;
use std::path::{Path, PathBuf};

const SQLITE_ARTIFACT_SUFFIXES: [&str; 4] = ["", "-wal", "-shm", "-journal"];
const DEPRECATED_ROOT_LAYOUT_SINCE_VERSION: &str = env!("CARGO_PKG_VERSION");
const DEPRECATED_ROOT_LAYOUT_REMOVE_IN_VERSION: &str = "0.0.1-alpha.20";

#[derive(Debug, Deserialize, Default)]
struct ConfigFileHints {
    #[serde(default)]
    database: Option<DatabaseFileHints>,
}

#[derive(Debug, Deserialize, Default)]
struct DatabaseFileHints {
    #[serde(default)]
    url: Option<String>,
}

pub fn load() -> Result<Config> {
    let base_dir = std::env::current_dir()
        .map_err(|e| AsterError::config_error(format!("failed to resolve current dir: {e}")))?;
    let env_database_url = std::env::var("ASTER__DATABASE__URL").ok();
    load_from_dir(&base_dir, env_database_url.as_deref(), true)
}

fn load_from_dir(
    base_dir: &Path,
    env_database_url: Option<&str>,
    include_env: bool,
) -> Result<Config> {
    let config_path = base_dir.join(DEFAULT_CONFIG_PATH);

    #[allow(deprecated)]
    reject_legacy_root_layout(base_dir, &config_path, env_database_url)?;

    if !config_path.exists() {
        create_default_config(&config_path)?;
    }

    let mut builder =
        RawConfig::builder().add_source(File::from(config_path.as_path()).required(false));

    if include_env {
        builder = builder.add_source(
            Environment::with_prefix("ASTER")
                .separator("__")
                .try_parsing(true),
        );
    } else if let Some(database_url) = env_database_url {
        builder = builder
            .set_override("database.url", database_url)
            .map_aster_err(AsterError::config_error)?;
    }

    let raw = builder.build().map_aster_err(AsterError::config_error)?;

    let mut cfg = raw
        .try_deserialize::<Config>()
        .map_aster_err(AsterError::config_error)?;

    resolve_loaded_paths(base_dir, &config_path, &mut cfg);

    eprintln!(
        "[INFO] Configuration loaded from: {}",
        config_path.display()
    );
    Ok(cfg)
}

fn create_default_config(config_path: &Path) -> Result<()> {
    let default = Config::default();
    let toml_str = toml::to_string_pretty(&default).map_aster_err(AsterError::config_error)?;

    let content = format!(
        "# AsterDrive 配置文件\n\
         # 由首次启动自动生成，请根据需要修改\n\
         # 相对路径默认相对于当前文件所在目录（默认是 ./data）\n\
         # 文档: https://asterdrive.docs.esap.cc/config/\n\n\
         {toml_str}"
    );

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            AsterError::config_error(format!(
                "failed to create config dir '{}': {e}",
                parent.display()
            ))
        })?;
    }

    std::fs::write(config_path, &content).map_err(|e| {
        AsterError::config_error(format!("failed to write {}: {e}", config_path.display()))
    })?;

    eprintln!(
        "[INFO] Default configuration written to: {}",
        config_path.display()
    );
    eprintln!("[INFO] Please review and modify it as needed.");
    Ok(())
}

#[deprecated(
    since = "0.0.1-alpha.17",
    note = "legacy root-level config/sqlite layout guard is a temporary alpha compatibility path and should be removed in 0.0.1-alpha.20"
)]
fn reject_legacy_root_layout(
    base_dir: &Path,
    config_path: &Path,
    env_database_url: Option<&str>,
) -> Result<()> {
    let legacy_config_path = base_dir.join(LEGACY_CONFIG_PATH);
    let config_dir = config_path.parent().unwrap_or(base_dir);

    if legacy_config_path.exists() && !config_path.exists() {
        return Err(AsterError::config_error(format!(
            "found deprecated root config '{}' (deprecated since {}) but '{}' is now required; \
             move it manually; this compatibility guard will be removed in {}",
            legacy_config_path.display(),
            DEPRECATED_ROOT_LAYOUT_SINCE_VERSION,
            config_path.display(),
            DEPRECATED_ROOT_LAYOUT_REMOVE_IN_VERSION
        )));
    }

    let config_db_url_hint = if config_path.exists() {
        read_config_database_url_hint(config_path)?
    } else {
        None
    };

    let effective_database_url = env_database_url
        .or(config_db_url_hint.as_deref())
        .unwrap_or(DEFAULT_CONFIG_SQLITE_DATABASE_URL);
    let resolved_effective_database_url =
        resolve_config_relative_sqlite_url(base_dir, config_dir, effective_database_url);
    let uses_default_sqlite_layout = resolved_effective_database_url == DEFAULT_SQLITE_DATABASE_URL;

    if uses_default_sqlite_layout {
        let legacy_db_path = base_dir.join(LEGACY_SQLITE_DATABASE_PATH);
        let default_db_path = base_dir.join(DEFAULT_SQLITE_DATABASE_PATH);
        let legacy_exists = sqlite_artifact_exists(&legacy_db_path);
        let default_exists = sqlite_artifact_exists(&default_db_path);

        if legacy_exists && !default_exists {
            return Err(AsterError::config_error(format!(
                "found deprecated root SQLite database '{}' (deprecated since {}) but current \
                 layout expects '{}'; move it manually before restarting; this compatibility \
                 guard will be removed in {}",
                legacy_db_path.display(),
                DEPRECATED_ROOT_LAYOUT_SINCE_VERSION,
                default_db_path.display(),
                DEPRECATED_ROOT_LAYOUT_REMOVE_IN_VERSION
            )));
        }
    }

    Ok(())
}

fn read_config_database_url_hint(config_path: &Path) -> Result<Option<String>> {
    let content = std::fs::read_to_string(config_path).map_err(|e| {
        AsterError::config_error(format!("failed to read {}: {e}", config_path.display()))
    })?;
    let hints = toml::from_str::<ConfigFileHints>(&content).map_err(|e| {
        AsterError::config_error(format!("failed to parse {}: {e}", config_path.display()))
    })?;
    Ok(hints.database.and_then(|database| database.url))
}

fn resolve_loaded_paths(base_dir: &Path, config_path: &Path, cfg: &mut Config) {
    let config_dir = config_path.parent().unwrap_or(base_dir);

    cfg.server.temp_dir = resolve_config_relative_path(base_dir, config_dir, &cfg.server.temp_dir);
    cfg.server.upload_temp_dir =
        resolve_config_relative_path(base_dir, config_dir, &cfg.server.upload_temp_dir);
    cfg.database.url = resolve_config_relative_sqlite_url(base_dir, config_dir, &cfg.database.url);
}

fn sqlite_artifact_exists(base: &Path) -> bool {
    SQLITE_ARTIFACT_SUFFIXES
        .iter()
        .any(|suffix| sqlite_artifact_path(base, suffix).exists())
}

fn sqlite_artifact_path(base: &Path, suffix: &str) -> PathBuf {
    if suffix.is_empty() {
        return base.to_path_buf();
    }

    let mut os = OsString::from(base.as_os_str());
    os.push(suffix);
    PathBuf::from(os)
}

#[cfg(test)]
mod tests {
    use super::load_from_dir;
    use crate::utils::paths::{
        DEFAULT_CONFIG_PATH, DEFAULT_SQLITE_DATABASE_PATH, DEFAULT_SQLITE_DATABASE_URL,
        DEFAULT_TEMP_DIR, DEFAULT_UPLOAD_TEMP_DIR, LEGACY_CONFIG_PATH, LEGACY_SQLITE_DATABASE_PATH,
    };
    use std::path::{Path, PathBuf};

    fn make_temp_dir(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "asterdrive-config-loader-{test_name}-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write(path: &Path, content: &[u8]) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn load_creates_default_config_under_data_dir() {
        let dir = make_temp_dir("create-default");

        let cfg = load_from_dir(&dir, None, false).unwrap();
        let generated = std::fs::read_to_string(dir.join(DEFAULT_CONFIG_PATH)).unwrap();

        assert_eq!(cfg.database.url, DEFAULT_SQLITE_DATABASE_URL);
        assert_eq!(cfg.server.temp_dir, DEFAULT_TEMP_DIR);
        assert_eq!(cfg.server.upload_temp_dir, DEFAULT_UPLOAD_TEMP_DIR);
        assert!(dir.join(DEFAULT_CONFIG_PATH).exists());
        assert!(!dir.join(LEGACY_CONFIG_PATH).exists());
        assert!(generated.contains(r#"url = "sqlite://asterdrive.db?mode=rwc""#));
        assert!(generated.contains(r#"temp_dir = ".tmp""#));
        assert!(generated.contains(r#"upload_temp_dir = ".uploads""#));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_rejects_legacy_root_config_layout() {
        let dir = make_temp_dir("legacy-config");
        write(
            &dir.join(LEGACY_CONFIG_PATH),
            br#"[database]
url = "sqlite://asterdrive.db?mode=rwc"
"#,
        );

        let err = load_from_dir(&dir, None, false).unwrap_err();

        assert!(err.message().contains("deprecated root config"));
        assert!(dir.join(LEGACY_CONFIG_PATH).exists());
        assert!(!dir.join(DEFAULT_CONFIG_PATH).exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_rejects_legacy_root_sqlite_database_layout() {
        let dir = make_temp_dir("legacy-db");
        write(&dir.join(LEGACY_SQLITE_DATABASE_PATH), b"legacy");

        let err = load_from_dir(&dir, None, false).unwrap_err();

        assert!(err.message().contains("deprecated root SQLite database"));
        assert!(dir.join(LEGACY_SQLITE_DATABASE_PATH).exists());
        assert!(!dir.join(DEFAULT_SQLITE_DATABASE_PATH).exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_keeps_existing_data_prefixed_paths_without_double_data() {
        let dir = make_temp_dir("legacy-data-prefixed-values");
        write(
            &dir.join(DEFAULT_CONFIG_PATH),
            br#"[database]
url = "sqlite://data/asterdrive.db?mode=rwc"

[server]
temp_dir = "data/.tmp"
upload_temp_dir = "data/.uploads"
"#,
        );

        let cfg = load_from_dir(&dir, None, false).unwrap();

        assert_eq!(cfg.database.url, DEFAULT_SQLITE_DATABASE_URL);
        assert_eq!(cfg.server.temp_dir, DEFAULT_TEMP_DIR);
        assert_eq!(cfg.server.upload_temp_dir, DEFAULT_UPLOAD_TEMP_DIR);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_resolves_relative_database_override_under_data_dir() {
        let dir = make_temp_dir("env-db-url-relative");
        write(&dir.join(LEGACY_SQLITE_DATABASE_PATH), b"legacy");

        let cfg = load_from_dir(&dir, Some("sqlite://custom.db?mode=rwc"), false).unwrap();

        assert_eq!(cfg.database.url, "sqlite://data/custom.db?mode=rwc");
        assert!(dir.join(DEFAULT_CONFIG_PATH).exists());
        assert!(dir.join(LEGACY_SQLITE_DATABASE_PATH).exists());
        assert!(!dir.join(DEFAULT_SQLITE_DATABASE_PATH).exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_accepts_legacy_root_relative_database_override_without_double_data() {
        let dir = make_temp_dir("env-db-url-legacy-root-relative");

        let cfg = load_from_dir(&dir, Some("sqlite://data/custom.db?mode=rwc"), false).unwrap();

        assert_eq!(cfg.database.url, "sqlite://data/custom.db?mode=rwc");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_rejects_legacy_root_sqlite_database_for_relative_default_override() {
        let dir = make_temp_dir("env-db-url-relative-default");
        write(&dir.join(LEGACY_SQLITE_DATABASE_PATH), b"legacy");

        let err = load_from_dir(&dir, Some("sqlite://asterdrive.db?mode=rwc"), false).unwrap_err();

        assert!(err.message().contains("deprecated root SQLite database"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn load_rejects_legacy_root_sqlite_database_for_data_prefixed_default_override() {
        let dir = make_temp_dir("env-db-url-data-prefixed-default");
        write(&dir.join(LEGACY_SQLITE_DATABASE_PATH), b"legacy");

        let err =
            load_from_dir(&dir, Some("sqlite://data/asterdrive.db?mode=rwc"), false).unwrap_err();

        assert!(err.message().contains("deprecated root SQLite database"));

        let _ = std::fs::remove_dir_all(dir);
    }
}
