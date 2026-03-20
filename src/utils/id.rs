use uuid::Uuid;

/// 生成 UUID v4 字符串（用于 share token 等）
pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

/// 生成短 token（32 字符 hex）
pub fn new_short_token() -> String {
    let id = Uuid::new_v4();
    id.simple().to_string()
}
