use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[schema(as = SystemConfig)]
#[sea_orm(table_name = "system_config")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub key: String,
    pub value: String,
    /// 值类型：string / number / boolean（前端渲染用）
    #[serde(default = "default_value_type")]
    pub value_type: String,
    /// 修改后是否需要重启才生效
    #[serde(default)]
    pub requires_restart: bool,
    /// 是否敏感值（前端脱敏显示）
    #[serde(default)]
    pub is_sensitive: bool,
    #[schema(value_type = String)]
    pub updated_at: DateTimeUtc,
    pub updated_by: Option<i64>,
}

fn default_value_type() -> String {
    "string".to_string()
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
