use chrono::Utc;
use sea_orm::Set;
use serde::Serialize;
use utoipa::ToSchema;

use crate::db::repository::{folder_repo, webdav_account_repo};
use crate::entities::webdav_account;
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::utils::hash;

/// 创建账号后返回的响应（包含一次性明文密码）
#[derive(Serialize, ToSchema)]
pub struct WebdavAccountCreated {
    pub id: i64,
    pub username: String,
    /// 明文密码，只返回一次
    pub password: String,
    pub root_folder_path: Option<String>,
}

/// 列表返回用的带路径的账号信息
#[derive(Serialize, ToSchema)]
pub struct WebdavAccountInfo {
    pub id: i64,
    pub username: String,
    pub root_folder_id: Option<i64>,
    /// 文件夹路径，如 "/Documents/Photos"，None 表示全部访问
    pub root_folder_path: Option<String>,
    pub is_active: bool,
    #[schema(value_type = String)]
    pub created_at: chrono::DateTime<Utc>,
    #[schema(value_type = String)]
    pub updated_at: chrono::DateTime<Utc>,
}

/// 创建 WebDAV 账号
///
/// password 为 None 时自动生成 16 位随机密码
pub async fn create(
    state: &AppState,
    user_id: i64,
    username: &str,
    password: Option<&str>,
    root_folder_id: Option<i64>,
) -> Result<WebdavAccountCreated> {
    // 检查用户名是否已存在
    if webdav_account_repo::find_by_username(&state.db, username)
        .await?
        .is_some()
    {
        return Err(AsterError::validation_error(
            "WebDAV username already exists",
        ));
    }

    // 生成或使用指定密码
    let plain_password = match password {
        Some(p) if !p.is_empty() => p.to_string(),
        _ => generate_random_password(16),
    };

    let password_hash = hash::hash_password(&plain_password)?;
    let now = Utc::now();

    // 如果指定了 root_folder_id，验证文件夹属于该用户
    let root_folder_path = if let Some(fid) = root_folder_id {
        let folder = folder_repo::find_by_id(&state.db, fid).await?;
        if folder.user_id != user_id {
            return Err(AsterError::auth_forbidden("not your folder"));
        }
        Some(build_folder_path(&state.db, fid).await?)
    } else {
        None
    };

    let model = webdav_account::ActiveModel {
        user_id: Set(user_id),
        username: Set(username.to_string()),
        password_hash: Set(password_hash),
        root_folder_id: Set(root_folder_id),
        is_active: Set(true),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };

    let created = webdav_account_repo::create(&state.db, model).await?;

    Ok(WebdavAccountCreated {
        id: created.id,
        username: created.username,
        password: plain_password,
        root_folder_path,
    })
}

/// 列出用户的所有 WebDAV 账号（带文件夹路径）
pub async fn list(state: &AppState, user_id: i64) -> Result<Vec<WebdavAccountInfo>> {
    let accounts = webdav_account_repo::find_by_user(&state.db, user_id).await?;
    let mut result = Vec::with_capacity(accounts.len());

    for acc in accounts {
        let root_folder_path = if let Some(fid) = acc.root_folder_id {
            build_folder_path(&state.db, fid).await.ok()
        } else {
            None
        };
        result.push(WebdavAccountInfo {
            id: acc.id,
            username: acc.username,
            root_folder_id: acc.root_folder_id,
            root_folder_path,
            is_active: acc.is_active,
            created_at: acc.created_at,
            updated_at: acc.updated_at,
        });
    }

    Ok(result)
}

/// 删除 WebDAV 账号（需要验证归属）
pub async fn delete(state: &AppState, id: i64, user_id: i64) -> Result<()> {
    let account = webdav_account_repo::find_by_id(&state.db, id).await?;
    if account.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your WebDAV account"));
    }
    webdav_account_repo::delete(&state.db, id).await
}

/// 切换启用/禁用
pub async fn toggle_active(
    state: &AppState,
    id: i64,
    user_id: i64,
) -> Result<webdav_account::Model> {
    let account = webdav_account_repo::find_by_id(&state.db, id).await?;
    if account.user_id != user_id {
        return Err(AsterError::auth_forbidden("not your WebDAV account"));
    }
    let mut active: webdav_account::ActiveModel = account.clone().into();
    active.is_active = Set(!account.is_active);
    active.updated_at = Set(Utc::now());
    webdav_account_repo::update(&state.db, active).await
}

/// 从 folder_id 向上遍历构建完整路径，如 "/Documents/Photos"
async fn build_folder_path(db: &sea_orm::DatabaseConnection, folder_id: i64) -> Result<String> {
    let mut parts = Vec::new();
    let mut current_id = Some(folder_id);

    while let Some(id) = current_id {
        let folder = folder_repo::find_by_id(db, id).await?;
        parts.push(folder.name);
        current_id = folder.parent_id;
    }

    parts.reverse();
    Ok(format!("/{}", parts.join("/")))
}

/// 测试 WebDAV 凭据是否正确
pub async fn test_credentials(state: &AppState, username: &str, password: &str) -> Result<()> {
    let account = webdav_account_repo::find_by_username(&state.db, username)
        .await?
        .ok_or_else(|| AsterError::auth_invalid_credentials("WebDAV account not found"))?;

    if !account.is_active {
        return Err(AsterError::auth_forbidden("WebDAV account is disabled"));
    }

    if !hash::verify_password(password, &account.password_hash)? {
        return Err(AsterError::auth_invalid_credentials("wrong password"));
    }

    let user = crate::db::repository::user_repo::find_by_id(&state.db, account.user_id).await?;
    if !user.status.is_active() {
        return Err(AsterError::auth_forbidden("user account is disabled"));
    }

    Ok(())
}

/// 生成随机密码
fn generate_random_password(len: usize) -> String {
    use rand::RngExt;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::rng();
    (0..len)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}
