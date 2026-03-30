use std::collections::HashMap;
use std::sync::RwLock;

use sea_orm::ConnectionTrait;

use crate::db::repository::policy_repo;
use crate::entities::storage_policy;
use crate::errors::{AsterError, Result};

#[derive(Default)]
struct PolicySnapshotData {
    policies_by_id: HashMap<i64, storage_policy::Model>,
    user_default_policy_by_user_id: HashMap<i64, i64>,
    system_default_policy_id: Option<i64>,
}

pub struct PolicySnapshot {
    snapshot: RwLock<PolicySnapshotData>,
}

impl PolicySnapshot {
    pub fn new() -> Self {
        Self {
            snapshot: RwLock::new(PolicySnapshotData::default()),
        }
    }

    pub async fn reload<C: ConnectionTrait>(&self, db: &C) -> Result<()> {
        let policies = policy_repo::find_all(db).await?;
        let user_defaults = policy_repo::find_all_user_defaults(db).await?;

        let system_default_policy_id = policies
            .iter()
            .find(|policy| policy.is_default)
            .map(|p| p.id);
        let policies_by_id = policies
            .into_iter()
            .map(|policy| (policy.id, policy))
            .collect();
        let user_default_policy_by_user_id = user_defaults
            .into_iter()
            .map(|assignment| (assignment.user_id, assignment.policy_id))
            .collect();

        *self
            .snapshot
            .write()
            .expect("policy snapshot lock poisoned") = PolicySnapshotData {
            policies_by_id,
            user_default_policy_by_user_id,
            system_default_policy_id,
        };

        Ok(())
    }

    pub fn get_policy(&self, policy_id: i64) -> Option<storage_policy::Model> {
        self.snapshot
            .read()
            .expect("policy snapshot lock poisoned")
            .policies_by_id
            .get(&policy_id)
            .cloned()
    }

    pub fn get_policy_or_err(&self, policy_id: i64) -> Result<storage_policy::Model> {
        self.get_policy(policy_id)
            .ok_or_else(|| AsterError::storage_policy_not_found(format!("policy #{policy_id}")))
    }

    pub fn resolve_default_policy_id(&self, user_id: i64) -> Option<i64> {
        let snapshot = self.snapshot.read().expect("policy snapshot lock poisoned");
        snapshot
            .user_default_policy_by_user_id
            .get(&user_id)
            .copied()
            .filter(|policy_id| snapshot.policies_by_id.contains_key(policy_id))
            .or(snapshot.system_default_policy_id)
    }

    pub fn resolve_default_policy(&self, user_id: i64) -> Option<storage_policy::Model> {
        let policy_id = self.resolve_default_policy_id(user_id)?;
        self.get_policy(policy_id)
    }

    pub fn system_default_policy(&self) -> Option<storage_policy::Model> {
        let policy_id = self
            .snapshot
            .read()
            .expect("policy snapshot lock poisoned")
            .system_default_policy_id?;
        self.get_policy(policy_id)
    }

    pub fn set_user_default_policy(&self, user_id: i64, policy_id: i64) {
        self.snapshot
            .write()
            .expect("policy snapshot lock poisoned")
            .user_default_policy_by_user_id
            .insert(user_id, policy_id);
    }

    pub fn remove_user_default_policy(&self, user_id: i64) {
        self.snapshot
            .write()
            .expect("policy snapshot lock poisoned")
            .user_default_policy_by_user_id
            .remove(&user_id);
    }
}

impl Default for PolicySnapshot {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::PolicySnapshot;
    use crate::config::DatabaseConfig;
    use crate::db;
    use crate::db::repository::{policy_repo, user_repo};
    use crate::types::{DriverType, UserRole, UserStatus};
    use chrono::Utc;
    use migration::{Migrator, MigratorTrait};
    use sea_orm::Set;

    async fn setup_db() -> sea_orm::DatabaseConnection {
        let db = db::connect(&DatabaseConfig {
            url: "sqlite::memory:".to_string(),
            pool_size: 1,
            retry_count: 0,
        })
        .await
        .unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    async fn create_policy(
        db: &sea_orm::DatabaseConnection,
        name: &str,
        base_path: &str,
        is_default: bool,
    ) -> crate::entities::storage_policy::Model {
        let now = Utc::now();
        policy_repo::create(
            db,
            crate::entities::storage_policy::ActiveModel {
                name: Set(name.to_string()),
                driver_type: Set(DriverType::Local),
                endpoint: Set(String::new()),
                bucket: Set(String::new()),
                access_key: Set(String::new()),
                secret_key: Set(String::new()),
                base_path: Set(base_path.to_string()),
                max_file_size: Set(0),
                allowed_types: Set("[]".to_string()),
                options: Set("{}".to_string()),
                is_default: Set(is_default),
                chunk_size: Set(5_242_880),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    async fn create_user(
        db: &sea_orm::DatabaseConnection,
        username: &str,
        email: &str,
    ) -> crate::entities::user::Model {
        let now = Utc::now();
        user_repo::create(
            db,
            crate::entities::user::ActiveModel {
                username: Set(username.to_string()),
                email: Set(email.to_string()),
                password_hash: Set("hashed-password".to_string()),
                role: Set(UserRole::User),
                status: Set(UserStatus::Active),
                session_version: Set(1),
                storage_used: Set(0),
                storage_quota: Set(0),
                created_at: Set(now),
                updated_at: Set(now),
                config: Set(None),
                ..Default::default()
            },
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn reload_exposes_policies_and_system_default() {
        let db = setup_db().await;
        let system_default =
            create_policy(&db, "System Default", "/tmp/policy-snap-default", true).await;
        let secondary = create_policy(&db, "Secondary", "/tmp/policy-snap-secondary", false).await;
        let snapshot = PolicySnapshot::new();

        snapshot.reload(&db).await.unwrap();

        assert_eq!(
            snapshot.system_default_policy().unwrap().id,
            system_default.id
        );
        assert_eq!(snapshot.get_policy(secondary.id).unwrap().name, "Secondary");
    }

    #[tokio::test]
    async fn resolve_default_policy_prefers_user_default_and_falls_back_to_system_default() {
        let db = setup_db().await;
        let system_default =
            create_policy(&db, "System Default", "/tmp/policy-snap-fallback", true).await;
        let user_default = create_policy(&db, "User Default", "/tmp/policy-snap-user", false).await;
        let now = Utc::now();
        let user = create_user(
            &db,
            "policy_snapshot_user",
            "policy_snapshot_user@example.com",
        )
        .await;

        policy_repo::create_user_policy(
            &db,
            crate::entities::user_storage_policy::ActiveModel {
                user_id: Set(user.id),
                policy_id: Set(user_default.id),
                is_default: Set(true),
                quota_bytes: Set(0),
                created_at: Set(now),
                ..Default::default()
            },
        )
        .await
        .unwrap();

        let snapshot = PolicySnapshot::new();
        snapshot.reload(&db).await.unwrap();

        assert_eq!(
            snapshot.resolve_default_policy_id(user.id),
            Some(user_default.id)
        );
        assert_eq!(
            snapshot.resolve_default_policy_id(9999),
            Some(system_default.id)
        );
    }

    #[tokio::test]
    async fn invalid_user_default_mapping_falls_back_to_system_default() {
        let db = setup_db().await;
        let system_default =
            create_policy(&db, "System Default", "/tmp/policy-snap-invalid", true).await;
        let snapshot = PolicySnapshot::new();
        snapshot.reload(&db).await.unwrap();

        snapshot.set_user_default_policy(7, 999_999);
        assert_eq!(
            snapshot.resolve_default_policy_id(7),
            Some(system_default.id)
        );

        snapshot.remove_user_default_policy(7);
        assert_eq!(
            snapshot.resolve_default_policy_id(7),
            Some(system_default.id)
        );
    }
}
