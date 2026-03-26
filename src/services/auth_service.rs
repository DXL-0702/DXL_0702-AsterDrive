use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sea_orm::Set;
use serde::{Deserialize, Serialize};

use crate::db::repository::{config_repo, policy_repo, user_repo};
use crate::entities::user;
use crate::errors::{AsterError, MapAsterErr, Result};
use crate::runtime::AppState;
use crate::types::{TokenType, UserRole, UserStatus};
use crate::utils::hash;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub user_id: i64,
    pub role: UserRole,
    pub token_type: TokenType,
    pub exp: usize,
}

// ── 输入校验 ──────────────────────────────────────────────────

fn validate_username(username: &str) -> Result<()> {
    let len = username.len();
    if len < 4 {
        return Err(AsterError::validation_error(
            "username must be at least 4 characters",
        ));
    }
    if len > 16 {
        return Err(AsterError::validation_error(
            "username must be at most 16 characters",
        ));
    }
    // 只允许字母、数字、下划线、连字符
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(AsterError::validation_error(
            "username may only contain letters, numbers, underscores and hyphens",
        ));
    }
    Ok(())
}

fn validate_email(email: &str) -> Result<()> {
    if email.len() > 254 {
        return Err(AsterError::validation_error("email is too long"));
    }
    // 基础格式校验：有且仅有一个 @，@ 前后非空，@ 后有点
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 || parts[0].is_empty() || parts[1].is_empty() {
        return Err(AsterError::validation_error("invalid email format"));
    }
    if !parts[1].contains('.') {
        return Err(AsterError::validation_error("invalid email format"));
    }
    Ok(())
}

fn validate_password(password: &str) -> Result<()> {
    if password.len() < 6 {
        return Err(AsterError::validation_error(
            "password must be at least 6 characters",
        ));
    }
    if password.len() > 128 {
        return Err(AsterError::validation_error(
            "password must be at most 128 characters",
        ));
    }
    Ok(())
}

async fn create_user_with_role(
    state: &AppState,
    username: &str,
    email: &str,
    password: &str,
    role: UserRole,
    status: UserStatus,
) -> Result<user::Model> {
    let db = &state.db;

    validate_username(username)?;
    validate_email(email)?;
    validate_password(password)?;

    if user_repo::find_by_username(db, username).await?.is_some() {
        return Err(AsterError::validation_error("username already exists"));
    }
    if user_repo::find_by_email(db, email).await?.is_some() {
        return Err(AsterError::validation_error("email already exists"));
    }

    let password_hash = hash::hash_password(password)?;
    let now = Utc::now();

    let default_quota = match config_repo::find_by_key(db, "default_storage_quota").await? {
        Some(cfg) => cfg.value.parse::<i64>().unwrap_or_else(|_| {
            tracing::warn!(
                "invalid default_storage_quota value '{}', using 0",
                cfg.value
            );
            0
        }),
        None => 0,
    };

    let model = user::ActiveModel {
        username: Set(username.to_string()),
        email: Set(email.to_string()),
        password_hash: Set(password_hash),
        role: Set(role),
        status: Set(status),
        storage_used: Set(0),
        storage_quota: Set(default_quota),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    let user = user_repo::create(db, model).await?;

    if let Ok(Some(default_policy)) = policy_repo::find_default(db).await {
        let usp = crate::entities::user_storage_policy::ActiveModel {
            user_id: Set(user.id),
            policy_id: Set(default_policy.id),
            is_default: Set(true),
            quota_bytes: Set(default_quota),
            created_at: Set(now),
            ..Default::default()
        };
        if let Err(e) = policy_repo::create_user_policy(db, usp).await {
            tracing::warn!(
                "failed to assign default policy to new user '{}': {e}",
                username
            );
        }
    }

    Ok(user)
}

pub async fn create_user_by_admin(
    state: &AppState,
    username: &str,
    email: &str,
    password: &str,
) -> Result<user::Model> {
    create_user_with_role(
        state,
        username,
        email,
        password,
        UserRole::User,
        UserStatus::Active,
    )
    .await
}

/// 注册用户，返回用户信息（不含密码）
pub async fn register(
    state: &AppState,
    username: &str,
    email: &str,
    password: &str,
) -> Result<user::Model> {
    let is_first_user = user_repo::count_all(&state.db).await? == 0;
    let role = if is_first_user {
        UserRole::Admin
    } else {
        UserRole::User
    };

    if is_first_user {
        tracing::info!("first user registered — granting admin role to '{username}'");
    }

    create_user_with_role(state, username, email, password, role, UserStatus::Active).await
}

/// 检查标识符（邮箱或用户名）是否存在，以及系统是否有用户
pub async fn check_identifier(state: &AppState, identifier: &str) -> Result<(bool, bool)> {
    let db = &state.db;
    let has_users = user_repo::count_all(db).await? > 0;
    let exists = find_user_by_identifier(db, identifier).await?.is_some();
    Ok((exists, has_users))
}

/// 按标识符查找用户（支持邮箱或用户名）
async fn find_user_by_identifier(
    db: &sea_orm::DatabaseConnection,
    identifier: &str,
) -> Result<Option<crate::entities::user::Model>> {
    if identifier.contains('@') {
        user_repo::find_by_email(db, identifier).await
    } else {
        user_repo::find_by_username(db, identifier).await
    }
}

/// 首次设置：仅在无用户时创建管理员
pub async fn setup(
    state: &AppState,
    username: &str,
    email: &str,
    password: &str,
) -> Result<crate::entities::user::Model> {
    let db = &state.db;
    if user_repo::count_all(db).await? > 0 {
        return Err(AsterError::validation_error("system already initialized"));
    }
    register(state, username, email, password).await
}

/// 登录，返回 (access_token, refresh_token)
/// identifier 支持邮箱或用户名
pub async fn login(state: &AppState, identifier: &str, password: &str) -> Result<(String, String)> {
    let db = &state.db;
    let auth_config = &state.config.auth;

    let user = find_user_by_identifier(db, identifier)
        .await?
        .ok_or_else(|| AsterError::auth_invalid_credentials("user not found"))?;

    if !user.status.is_active() {
        return Err(AsterError::auth_forbidden("account is disabled"));
    }

    if !hash::verify_password(password, &user.password_hash)? {
        return Err(AsterError::auth_invalid_credentials("wrong password"));
    }

    let access = create_token(
        user.id,
        user.role,
        TokenType::Access,
        auth_config.access_token_ttl_secs,
        &auth_config.jwt_secret,
    )?;
    let refresh = create_token(
        user.id,
        user.role,
        TokenType::Refresh,
        auth_config.refresh_token_ttl_secs,
        &auth_config.jwt_secret,
    )?;

    Ok((access, refresh))
}

/// 用 refresh token 换 access token
pub fn refresh_token(state: &AppState, refresh: &str) -> Result<String> {
    let auth_config = &state.config.auth;
    let claims = verify_token(refresh, &auth_config.jwt_secret)?;
    if claims.token_type != TokenType::Refresh {
        return Err(AsterError::auth_token_invalid("not a refresh token"));
    }
    create_token(
        claims.user_id,
        claims.role,
        TokenType::Access,
        auth_config.access_token_ttl_secs,
        &auth_config.jwt_secret,
    )
}

fn create_token(
    user_id: i64,
    role: UserRole,
    token_type: TokenType,
    ttl_secs: u64,
    secret: &str,
) -> Result<String> {
    let exp = (Utc::now().timestamp() as u64 + ttl_secs) as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        user_id,
        role,
        token_type,
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_aster_err(AsterError::internal_error)
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
            AsterError::auth_token_expired("token expired")
        }
        _ => AsterError::auth_token_invalid(e.to_string()),
    })?;
    Ok(data.claims)
}
