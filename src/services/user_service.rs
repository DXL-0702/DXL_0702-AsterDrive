use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, Set};

use crate::db::repository::user_repo;
use crate::entities::user;
use crate::errors::{AsterError, Result};
use crate::types::{UserRole, UserStatus};

pub async fn list_all(db: &DatabaseConnection) -> Result<Vec<user::Model>> {
    user_repo::find_all(db).await
}

pub async fn get(db: &DatabaseConnection, id: i64) -> Result<user::Model> {
    user_repo::find_by_id(db, id).await
}

pub async fn update(
    db: &DatabaseConnection,
    id: i64,
    role: Option<UserRole>,
    status: Option<UserStatus>,
) -> Result<user::Model> {
    let existing = user_repo::find_by_id(db, id).await?;
    let mut active: user::ActiveModel = existing.into();
    if let Some(r) = role {
        active.role = Set(r);
    }
    if let Some(s) = status {
        active.status = Set(s);
    }
    active.updated_at = Set(Utc::now());
    active.update(db).await.map_err(AsterError::from)
}
