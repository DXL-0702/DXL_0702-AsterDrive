use actix_governor::{GovernorConfig, GovernorConfigBuilder, KeyExtractor, SimpleKeyExtractionError};
use actix_web::dev::ServiceRequest;
use actix_web::http::header::ContentType;
use actix_web::{HttpResponse, HttpResponseBuilder};
use governor::clock::{Clock, DefaultClock, QuantaInstant};
use governor::middleware::NoOpMiddleware;
use governor::NotUntil;
use std::net::IpAddr;

use crate::config::RateLimitTier;

/// IP-based key extractor，429 响应返回 ApiResponse JSON 格式
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AsterIpKeyExtractor;

impl KeyExtractor for AsterIpKeyExtractor {
    type Key = IpAddr;
    type KeyExtractionError = SimpleKeyExtractionError<&'static str>;

    fn extract(&self, req: &ServiceRequest) -> Result<Self::Key, Self::KeyExtractionError> {
        // peer_addr 在测试环境中可能为 None，fallback 到 loopback
        let ip = req
            .peer_addr()
            .map(|socket| socket.ip())
            .unwrap_or(IpAddr::from([127, 0, 0, 1]));
        Ok(ip)
    }

    fn exceed_rate_limit_response(
        &self,
        negative: &NotUntil<QuantaInstant>,
        mut response: HttpResponseBuilder,
    ) -> HttpResponse {
        let wait_time = negative
            .wait_time_from(DefaultClock::default().now())
            .as_secs();
        response
            .insert_header(("Retry-After", wait_time.to_string()))
            .content_type(ContentType::json())
            .body(format!(
                r#"{{"code":1006,"msg":"Too Many Requests, retry after {wait_time}s"}}"#
            ))
    }
}

/// 根据 tier 配置创建 Governor 实例
pub fn build_governor(tier: &RateLimitTier) -> GovernorConfig<AsterIpKeyExtractor, NoOpMiddleware> {
    GovernorConfigBuilder::default()
        .key_extractor(AsterIpKeyExtractor)
        .seconds_per_request(tier.seconds_per_request)
        .burst_size(tier.burst_size)
        .finish()
        .expect("invalid rate limit config")
}
