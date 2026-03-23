pub mod logging;
pub mod panic;
pub mod shutdown;
pub mod startup;
pub mod tasks;

use crate::cache::CacheBackend;
use crate::config::Config;
use crate::storage::DriverRegistry;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

pub struct AppState {
    pub db: DatabaseConnection,
    pub driver_registry: Arc<DriverRegistry>,
    pub config: Arc<Config>,
    pub cache: Arc<dyn CacheBackend>,
}
