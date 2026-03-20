mod loader;
mod schema;

pub use schema::{AuthConfig, CacheConfig, Config, DatabaseConfig, LoggingConfig, ServerConfig};

use std::sync::Arc;
use std::sync::OnceLock;

static CONFIG: OnceLock<Arc<Config>> = OnceLock::new();

pub fn init_config() -> crate::errors::Result<()> {
    let cfg = loader::load()?;
    CONFIG.get_or_init(|| Arc::new(cfg));
    Ok(())
}

pub fn get_config() -> Arc<Config> {
    CONFIG
        .get()
        .expect("Config not initialized. Call init_config() first.")
        .clone()
}
