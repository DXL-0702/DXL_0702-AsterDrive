use crate::entities::upload_session::{self, Entity as UploadSession};
use crate::errors::{AsterError, Result};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};

pub async fn find_by_id(db: &DatabaseConnection, id: &str) -> Result<upload_session::Model> {
    UploadSession::find_by_id(id.to_string())
        .one(db)
        .await
        .map_err(AsterError::from)?
        .ok_or_else(|| AsterError::upload_session_not_found(format!("session {id}")))
}

pub async fn create(
    db: &DatabaseConnection,
    model: upload_session::ActiveModel,
) -> Result<upload_session::Model> {
    model.insert(db).await.map_err(AsterError::from)
}

pub async fn update(
    db: &DatabaseConnection,
    model: upload_session::ActiveModel,
) -> Result<upload_session::Model> {
    model.update(db).await.map_err(AsterError::from)
}

pub async fn delete(db: &DatabaseConnection, id: &str) -> Result<()> {
    UploadSession::delete_by_id(id.to_string())
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}

/// 查找所有过期且未完成的 session
pub async fn find_expired(db: &DatabaseConnection) -> Result<Vec<upload_session::Model>> {
    let now = chrono::Utc::now();
    UploadSession::find()
        .filter(upload_session::Column::ExpiresAt.lt(now))
        .filter(upload_session::Column::Status.ne("completed"))
        .all(db)
        .await
        .map_err(AsterError::from)
}
