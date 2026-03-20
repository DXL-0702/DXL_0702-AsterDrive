use actix_web::HttpResponse;
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub msg: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            code: 0,
            msg: String::new(),
            data: Some(data),
        }
    }

    pub fn ok_empty() -> ApiResponse<()> {
        ApiResponse {
            code: 0,
            msg: String::new(),
            data: None,
        }
    }

    pub fn error(code: &str, msg: &str) -> ApiResponse<()> {
        ApiResponse {
            code: -1,
            msg: format!("{}: {}", code, msg),
            data: None,
        }
    }
}

impl<T: Serialize> ApiResponse<T> {
    pub fn into_response(self) -> HttpResponse {
        HttpResponse::Ok().json(self)
    }
}
