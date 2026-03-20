use super::driver::StorageDriver;
use super::local::LocalDriver;
use crate::entities::storage_policy;
use crate::errors::{AsterError, Result};
use dashmap::DashMap;
use std::sync::Arc;

pub struct DriverRegistry {
    /// policy_id → 已实例化的 driver
    drivers: DashMap<i64, Arc<dyn StorageDriver>>,
}

impl DriverRegistry {
    pub fn new() -> Self {
        Self {
            drivers: DashMap::new(),
        }
    }

    /// 根据 StoragePolicy 获取或创建 driver（惰性实例化）
    pub fn get_driver(&self, policy: &storage_policy::Model) -> Result<Arc<dyn StorageDriver>> {
        if let Some(driver) = self.drivers.get(&policy.id) {
            return Ok(driver.clone());
        }
        let driver = self.create_driver(policy)?;
        self.drivers.insert(policy.id, driver.clone());
        Ok(driver)
    }

    /// 策略更新后使缓存的 driver 失效
    pub fn invalidate(&self, policy_id: i64) {
        self.drivers.remove(&policy_id);
    }

    fn create_driver(&self, policy: &storage_policy::Model) -> Result<Arc<dyn StorageDriver>> {
        match policy.driver_type.as_str() {
            "local" => Ok(Arc::new(LocalDriver::new(policy)?)),
            other => Err(AsterError::unsupported_driver(format!(
                "driver type '{}' is not supported yet",
                other
            ))),
        }
    }
}

impl Default for DriverRegistry {
    fn default() -> Self {
        Self::new()
    }
}
