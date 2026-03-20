use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[schema(as = ShareInfo)]
#[sea_orm(table_name = "shares")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub token: String,
    pub user_id: i64,
    pub file_id: Option<i64>,
    pub folder_id: Option<i64>,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    #[schema(value_type = Option<String>)]
    pub expires_at: Option<DateTimeUtc>,
    pub max_downloads: i64, // 0 = unlimited
    pub download_count: i64,
    pub view_count: i64,
    #[schema(value_type = String)]
    pub created_at: DateTimeUtc,
    #[schema(value_type = String)]
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::file::Entity",
        from = "Column::FileId",
        to = "super::file::Column::Id"
    )]
    File,
    #[sea_orm(
        belongs_to = "super::folder::Entity",
        from = "Column::FolderId",
        to = "super::folder::Column::Id"
    )]
    Folder,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl Related<super::file::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::File.def()
    }
}

impl Related<super::folder::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Folder.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
