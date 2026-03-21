use chrono::Utc;
use sea_orm::{ActiveModelTrait, Set};

use crate::db::repository::user_repo;
use crate::entities::user;
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::types::{UserRole, UserStatus};

pub async fn list_all(state: &AppState) -> Result<Vec<user::Model>> {
    user_repo::find_all(&state.db).await
}

pub async fn get(state: &AppState, id: i64) -> Result<user::Model> {
    user_repo::find_by_id(&state.db, id).await
}

pub async fn update(
    state: &AppState,
    id: i64,
    role: Option<UserRole>,
    status: Option<UserStatus>,
    storage_quota: Option<i64>,
) -> Result<user::Model> {
    let existing = user_repo::find_by_id(&state.db, id).await?;
    let mut active: user::ActiveModel = existing.into();
    if let Some(r) = role {
        active.role = Set(r);
    }
    if let Some(s) = status {
        active.status = Set(s);
    }
    if let Some(q) = storage_quota {
        active.storage_quota = Set(q);
    }
    active.updated_at = Set(Utc::now());
    active.update(&state.db).await.map_err(AsterError::from)
}
