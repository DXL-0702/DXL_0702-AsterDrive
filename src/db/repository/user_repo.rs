use crate::entities::user::{self, Entity as User};
use crate::errors::{AsterError, Result};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, PaginatorTrait, QueryFilter, Set,
};

pub async fn find_by_id<C: ConnectionTrait>(db: &C, id: i64) -> Result<user::Model> {
    User::find_by_id(id)
        .one(db)
        .await
        .map_err(AsterError::from)?
        .ok_or_else(|| AsterError::record_not_found(format!("user #{id}")))
}

pub async fn find_by_username<C: ConnectionTrait>(
    db: &C,
    username: &str,
) -> Result<Option<user::Model>> {
    User::find()
        .filter(user::Column::Username.eq(username))
        .one(db)
        .await
        .map_err(AsterError::from)
}

pub async fn find_by_email<C: ConnectionTrait>(db: &C, email: &str) -> Result<Option<user::Model>> {
    User::find()
        .filter(user::Column::Email.eq(email))
        .one(db)
        .await
        .map_err(AsterError::from)
}

pub async fn find_all<C: ConnectionTrait>(db: &C) -> Result<Vec<user::Model>> {
    User::find().all(db).await.map_err(AsterError::from)
}

pub async fn count_all<C: ConnectionTrait>(db: &C) -> Result<u64> {
    User::find().count(db).await.map_err(AsterError::from)
}

pub async fn create<C: ConnectionTrait>(db: &C, model: user::ActiveModel) -> Result<user::Model> {
    model.insert(db).await.map_err(AsterError::from)
}

pub async fn update_storage_used<C: ConnectionTrait>(db: &C, id: i64, delta: i64) -> Result<()> {
    let user = find_by_id(db, id).await?;
    let new_used = (user.storage_used + delta).max(0);
    let mut active: user::ActiveModel = user.into();
    active.storage_used = Set(new_used);
    active.update(db).await.map_err(AsterError::from)?;
    Ok(())
}
