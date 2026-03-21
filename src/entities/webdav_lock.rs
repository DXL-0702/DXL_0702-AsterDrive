use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[schema(as = WebdavLock)]
#[sea_orm(table_name = "webdav_locks")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub token: String,
    pub path: String,
    pub principal: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub owner_xml: Option<String>,
    #[schema(value_type = Option<String>)]
    pub timeout_at: Option<DateTimeUtc>,
    pub shared: bool,
    pub deep: bool,
    #[schema(value_type = String)]
    pub created_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
