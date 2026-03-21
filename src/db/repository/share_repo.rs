use crate::entities::share::{self, Entity as Share};
use crate::errors::{AsterError, Result};
use sea_orm::{ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, Set};

pub async fn find_by_id<C: ConnectionTrait>(db: &C, id: i64) -> Result<share::Model> {
    Share::find_by_id(id)
        .one(db)
        .await
        .map_err(AsterError::from)?
        .ok_or_else(|| AsterError::share_not_found(format!("share #{id}")))
}

pub async fn find_by_token<C: ConnectionTrait>(
    db: &C,
    token: &str,
) -> Result<Option<share::Model>> {
    Share::find()
        .filter(share::Column::Token.eq(token))
        .one(db)
        .await
        .map_err(AsterError::from)
}

pub async fn find_by_user<C: ConnectionTrait>(db: &C, user_id: i64) -> Result<Vec<share::Model>> {
    Share::find()
        .filter(share::Column::UserId.eq(user_id))
        .all(db)
        .await
        .map_err(AsterError::from)
}

pub async fn find_all<C: ConnectionTrait>(db: &C) -> Result<Vec<share::Model>> {
    Share::find().all(db).await.map_err(AsterError::from)
}

/// 查找用户对同一资源是否已有活跃分享
pub async fn find_active_by_resource<C: ConnectionTrait>(
    db: &C,
    user_id: i64,
    file_id: Option<i64>,
    folder_id: Option<i64>,
) -> Result<Option<share::Model>> {
    let mut q = Share::find().filter(share::Column::UserId.eq(user_id));
    if let Some(fid) = file_id {
        q = q.filter(share::Column::FileId.eq(fid));
    }
    if let Some(fid) = folder_id {
        q = q.filter(share::Column::FolderId.eq(fid));
    }
    q.one(db).await.map_err(AsterError::from)
}

pub async fn create<C: ConnectionTrait>(db: &C, model: share::ActiveModel) -> Result<share::Model> {
    model.insert(db).await.map_err(AsterError::from)
}

pub async fn delete<C: ConnectionTrait>(db: &C, id: i64) -> Result<()> {
    Share::delete_by_id(id)
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}

pub async fn increment_view_count<C: ConnectionTrait>(db: &C, id: i64) -> Result<()> {
    let share = find_by_id(db, id).await?;
    let new_count = share.view_count + 1;
    let mut active: share::ActiveModel = share.into();
    active.view_count = Set(new_count);
    active.update(db).await.map_err(AsterError::from)?;
    Ok(())
}

pub async fn increment_download_count<C: ConnectionTrait>(db: &C, id: i64) -> Result<()> {
    let share = find_by_id(db, id).await?;
    let new_count = share.download_count + 1;
    let mut active: share::ActiveModel = share.into();
    active.download_count = Set(new_count);
    active.update(db).await.map_err(AsterError::from)?;
    Ok(())
}
