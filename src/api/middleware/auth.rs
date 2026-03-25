use actix_web::{
    Error, HttpMessage,
    dev::{Service, ServiceRequest, ServiceResponse, Transform, forward_ready},
    web,
};
use futures::future::{LocalBoxFuture, Ready, ok};
use std::rc::Rc;

use crate::cache::CacheExt;
use crate::errors::AsterError;
use crate::runtime::AppState;
use crate::services::auth_service;
use crate::types::UserStatus;

const ACCESS_COOKIE: &str = "aster_access";
const USER_STATUS_TTL: u64 = 30; // 秒

/// JWT 认证中间件
/// 优先从 cookie 取 token，fallback 到 Authorization: Bearer header
pub struct JwtAuth;

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = JwtAuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(JwtAuthMiddleware {
            service: Rc::new(service),
        })
    }
}

pub struct JwtAuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();

        Box::pin(async move {
            let state = req
                .app_data::<web::Data<AppState>>()
                .expect("AppState not found");

            // 1. Cookie 优先
            // 2. Authorization: Bearer fallback
            let token = req
                .cookie(ACCESS_COOKIE)
                .map(|c| c.value().to_string())
                .or_else(|| {
                    req.headers()
                        .get("Authorization")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.strip_prefix("Bearer "))
                        .map(|s| s.to_string())
                });

            match token {
                None => Err(AsterError::auth_invalid_credentials("missing token").into()),
                Some(t) => match auth_service::verify_token(&t, &state.config.auth.jwt_secret) {
                    Ok(claims) => {
                        // 查缓存确认用户状态（TTL=30s，避免每次打 DB）
                        let cache_key = format!("user_status:{}", claims.user_id);
                        let status: Option<UserStatus> =
                            state.cache.get(&cache_key).await;

                        let is_active = match status {
                            Some(s) => s.is_active(),
                            None => {
                                // 缓存未命中，查 DB
                                let user =
                                    crate::db::repository::user_repo::find_by_id(
                                        &state.db,
                                        claims.user_id,
                                    )
                                    .await;
                                match user {
                                    Ok(u) => {
                                        state
                                            .cache
                                            .set(&cache_key, &u.status, Some(USER_STATUS_TTL))
                                            .await;
                                        u.status.is_active()
                                    }
                                    Err(_) => {
                                        return Err(AsterError::auth_invalid_credentials(
                                            "user not found",
                                        )
                                        .into());
                                    }
                                }
                            }
                        };

                        if is_active {
                            req.extensions_mut().insert(claims);
                            svc.call(req).await
                        } else {
                            Err(AsterError::auth_forbidden("account is disabled").into())
                        }
                    }
                    Err(_) => Err(AsterError::auth_token_invalid("invalid token").into()),
                },
            }
        })
    }
}
