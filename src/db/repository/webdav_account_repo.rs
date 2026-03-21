use sea_orm::{ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter};

use crate::entities::webdav_account::{self, Entity as WebdavAccount};
use crate::errors::{AsterError, Result};

pub async fn find_by_id<C: ConnectionTrait>(db: &C, id: i64) -> Result<webdav_account::Model> {
    WebdavAccount::find_by_id(id)
        .one(db)
        .await
        .map_err(AsterError::from)?
        .ok_or_else(|| AsterError::record_not_found(format!("webdav_account #{id}")))
}

pub async fn find_by_username<C: ConnectionTrait>(
    db: &C,
    username: &str,
) -> Result<Option<webdav_account::Model>> {
    WebdavAccount::find()
        .filter(webdav_account::Column::Username.eq(username))
        .one(db)
        .await
        .map_err(AsterError::from)
}

pub async fn find_by_user<C: ConnectionTrait>(
    db: &C,
    user_id: i64,
) -> Result<Vec<webdav_account::Model>> {
    WebdavAccount::find()
        .filter(webdav_account::Column::UserId.eq(user_id))
        .all(db)
        .await
        .map_err(AsterError::from)
}

pub async fn create<C: ConnectionTrait>(
    db: &C,
    model: webdav_account::ActiveModel,
) -> Result<webdav_account::Model> {
    model.insert(db).await.map_err(AsterError::from)
}

pub async fn update<C: ConnectionTrait>(
    db: &C,
    model: webdav_account::ActiveModel,
) -> Result<webdav_account::Model> {
    model.update(db).await.map_err(AsterError::from)
}

pub async fn delete<C: ConnectionTrait>(db: &C, id: i64) -> Result<()> {
    WebdavAccount::delete_by_id(id)
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}
