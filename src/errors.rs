use actix_web::http::StatusCode;

macro_rules! define_errors {
    ($(
        $variant:ident($code:literal, $type_name:literal, $status:expr)
    ),* $(,)?) => {
        #[derive(Debug, Clone)]
        pub enum AsterError {
            $($variant(String),)*
        }

        impl AsterError {
            pub fn code(&self) -> &'static str {
                match self {
                    $(AsterError::$variant(_) => $code,)*
                }
            }

            pub fn type_name(&self) -> &'static str {
                match self {
                    $(AsterError::$variant(_) => $type_name,)*
                }
            }

            pub fn message(&self) -> &str {
                match self {
                    $(AsterError::$variant(msg) => msg.as_str(),)*
                }
            }

            pub fn http_status(&self) -> StatusCode {
                match self {
                    $(AsterError::$variant(_) => $status,)*
                }
            }
        }

        impl std::fmt::Display for AsterError {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "[{}] {}", self.code(), self.message())
            }
        }

        impl std::error::Error for AsterError {}
    };
}

define_errors! {
    // 认证 A0xx
    AuthInvalidCredentials("A001", "Invalid Credentials",        StatusCode::UNAUTHORIZED),
    AuthTokenExpired(      "A002", "Token Expired",              StatusCode::UNAUTHORIZED),
    AuthForbidden(         "A003", "Forbidden",                  StatusCode::FORBIDDEN),
    AuthTokenInvalid(      "A004", "Token Invalid",              StatusCode::UNAUTHORIZED),

    // 文件 F0xx
    FileNotFound(          "F001", "File Not Found",             StatusCode::NOT_FOUND),
    FileTooLarge(          "F002", "File Too Large",             StatusCode::PAYLOAD_TOO_LARGE),
    FileTypeNotAllowed(    "F003", "File Type Not Allowed",      StatusCode::UNSUPPORTED_MEDIA_TYPE),
    FileUploadFailed(      "F004", "Upload Failed",              StatusCode::INTERNAL_SERVER_ERROR),

    // 存储 S0xx
    StoragePolicyNotFound( "S001", "Storage Policy Not Found",   StatusCode::NOT_FOUND),
    StorageDriverError(    "S002", "Storage Driver Error",       StatusCode::INTERNAL_SERVER_ERROR),
    StorageQuotaExceeded(  "S003", "Quota Exceeded",             StatusCode::INSUFFICIENT_STORAGE),
    UnsupportedDriver(     "S004", "Unsupported Driver",         StatusCode::BAD_REQUEST),

    // 数据库 D0xx
    DatabaseError(         "D001", "Database Error",             StatusCode::INTERNAL_SERVER_ERROR),
    RecordNotFound(        "D002", "Record Not Found",           StatusCode::NOT_FOUND),

    // 通用 G0xx
    ValidationError(       "G001", "Validation Error",           StatusCode::BAD_REQUEST),
    InternalError(         "G002", "Internal Error",             StatusCode::INTERNAL_SERVER_ERROR),
    ConfigError(           "G003", "Configuration Error",        StatusCode::INTERNAL_SERVER_ERROR),
}

impl AsterError {
    pub fn auth_invalid_credentials(msg: impl Into<String>) -> Self {
        Self::AuthInvalidCredentials(msg.into())
    }
    pub fn auth_token_expired(msg: impl Into<String>) -> Self {
        Self::AuthTokenExpired(msg.into())
    }
    pub fn auth_forbidden(msg: impl Into<String>) -> Self {
        Self::AuthForbidden(msg.into())
    }
    pub fn auth_token_invalid(msg: impl Into<String>) -> Self {
        Self::AuthTokenInvalid(msg.into())
    }
    pub fn file_not_found(msg: impl Into<String>) -> Self {
        Self::FileNotFound(msg.into())
    }
    pub fn file_too_large(msg: impl Into<String>) -> Self {
        Self::FileTooLarge(msg.into())
    }
    pub fn file_type_not_allowed(msg: impl Into<String>) -> Self {
        Self::FileTypeNotAllowed(msg.into())
    }
    pub fn file_upload_failed(msg: impl Into<String>) -> Self {
        Self::FileUploadFailed(msg.into())
    }
    pub fn storage_policy_not_found(msg: impl Into<String>) -> Self {
        Self::StoragePolicyNotFound(msg.into())
    }
    pub fn storage_driver_error(msg: impl Into<String>) -> Self {
        Self::StorageDriverError(msg.into())
    }
    pub fn storage_quota_exceeded(msg: impl Into<String>) -> Self {
        Self::StorageQuotaExceeded(msg.into())
    }
    pub fn unsupported_driver(msg: impl Into<String>) -> Self {
        Self::UnsupportedDriver(msg.into())
    }
    pub fn database_error(msg: impl Into<String>) -> Self {
        Self::DatabaseError(msg.into())
    }
    pub fn record_not_found(msg: impl Into<String>) -> Self {
        Self::RecordNotFound(msg.into())
    }
    pub fn validation_error(msg: impl Into<String>) -> Self {
        Self::ValidationError(msg.into())
    }
    pub fn internal_error(msg: impl Into<String>) -> Self {
        Self::InternalError(msg.into())
    }
    pub fn config_error(msg: impl Into<String>) -> Self {
        Self::ConfigError(msg.into())
    }
}

impl From<sea_orm::DbErr> for AsterError {
    fn from(e: sea_orm::DbErr) -> Self {
        match e {
            sea_orm::DbErr::RecordNotFound(msg) => Self::RecordNotFound(msg),
            other => Self::DatabaseError(other.to_string()),
        }
    }
}

impl actix_web::ResponseError for AsterError {
    fn status_code(&self) -> StatusCode {
        self.http_status()
    }

    fn error_response(&self) -> actix_web::HttpResponse {
        use crate::api::response::ApiResponse;
        actix_web::HttpResponse::build(self.http_status())
            .json(ApiResponse::<()>::error(self.code(), self.message()))
    }
}

pub type Result<T> = std::result::Result<T, AsterError>;
