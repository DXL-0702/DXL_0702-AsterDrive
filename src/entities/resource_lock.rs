use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
#[cfg(all(debug_assertions, feature = "openapi"))]
use utoipa::ToSchema;

use crate::types::EntityType;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[cfg_attr(all(debug_assertions, feature = "openapi"), derive(ToSchema))]
#[cfg_attr(all(debug_assertions, feature = "openapi"), schema(as = ResourceLock))]
#[sea_orm(table_name = "resource_locks")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub token: String,
    pub entity_type: EntityType,
    pub entity_id: i64,
    pub path: String,
    pub owner_id: Option<i64>,
    #[sea_orm(column_type = "Text", nullable)]
    pub owner_info: Option<String>,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = Option<String>))]
    pub timeout_at: Option<DateTimeUtc>,
    pub shared: bool,
    pub deep: bool,
    #[cfg_attr(all(debug_assertions, feature = "openapi"), schema(value_type = String))]
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
