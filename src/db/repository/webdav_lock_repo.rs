use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

use crate::entities::webdav_lock::{self, Entity as WebdavLock};
use crate::errors::{AsterError, Result};

/// 列出所有锁
pub async fn find_all(db: &DatabaseConnection) -> Result<Vec<webdav_lock::Model>> {
    WebdavLock::find().all(db).await.map_err(AsterError::from)
}

/// 按 ID 查找
pub async fn find_by_id(db: &DatabaseConnection, id: i64) -> Result<Option<webdav_lock::Model>> {
    WebdavLock::find_by_id(id)
        .one(db)
        .await
        .map_err(AsterError::from)
}

/// 按 ID 强制删除
pub async fn delete_by_id(db: &DatabaseConnection, id: i64) -> Result<()> {
    WebdavLock::delete_by_id(id)
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}

pub async fn create(
    db: &DatabaseConnection,
    model: webdav_lock::ActiveModel,
) -> Result<webdav_lock::Model> {
    model.insert(db).await.map_err(AsterError::from)
}

pub async fn find_by_token(
    db: &DatabaseConnection,
    token: &str,
) -> Result<Option<webdav_lock::Model>> {
    WebdavLock::find()
        .filter(webdav_lock::Column::Token.eq(token))
        .one(db)
        .await
        .map_err(AsterError::from)
}

/// 查询精确路径的所有锁
pub async fn find_by_path(db: &DatabaseConnection, path: &str) -> Result<Vec<webdav_lock::Model>> {
    WebdavLock::find()
        .filter(webdav_lock::Column::Path.eq(path))
        .all(db)
        .await
        .map_err(AsterError::from)
}

/// 查询路径前缀匹配的所有锁（后代锁）
pub async fn find_by_path_prefix(
    db: &DatabaseConnection,
    prefix: &str,
) -> Result<Vec<webdav_lock::Model>> {
    WebdavLock::find()
        .filter(webdav_lock::Column::Path.starts_with(prefix))
        .all(db)
        .await
        .map_err(AsterError::from)
}

/// 查询指定路径列表中的所有锁（祖先锁）
pub async fn find_ancestors(
    db: &DatabaseConnection,
    paths: &[String],
) -> Result<Vec<webdav_lock::Model>> {
    if paths.is_empty() {
        return Ok(vec![]);
    }
    WebdavLock::find()
        .filter(webdav_lock::Column::Path.is_in(paths.iter().map(|s| s.as_str())))
        .all(db)
        .await
        .map_err(AsterError::from)
}

pub async fn delete_by_token(db: &DatabaseConnection, token: &str) -> Result<()> {
    WebdavLock::delete_many()
        .filter(webdav_lock::Column::Token.eq(token))
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(())
}

/// 删除路径及所有子路径的锁
pub async fn delete_by_path_prefix(db: &DatabaseConnection, prefix: &str) -> Result<u64> {
    let res = WebdavLock::delete_many()
        .filter(webdav_lock::Column::Path.starts_with(prefix))
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(res.rows_affected)
}

/// 清理过期锁
pub async fn delete_expired(db: &DatabaseConnection) -> Result<u64> {
    let now = Utc::now();
    let res = WebdavLock::delete_many()
        .filter(webdav_lock::Column::TimeoutAt.is_not_null())
        .filter(webdav_lock::Column::TimeoutAt.lt(now))
        .exec(db)
        .await
        .map_err(AsterError::from)?;
    Ok(res.rows_affected)
}

/// 刷新锁超时
pub async fn refresh(
    db: &DatabaseConnection,
    token: &str,
    new_timeout_at: Option<chrono::DateTime<Utc>>,
) -> Result<Option<webdav_lock::Model>> {
    let lock = find_by_token(db, token).await?;
    match lock {
        Some(l) => {
            let mut active: webdav_lock::ActiveModel = l.into();
            active.timeout_at = Set(new_timeout_at);
            let updated = active.update(db).await.map_err(AsterError::from)?;
            Ok(Some(updated))
        }
        None => Ok(None),
    }
}
