//! 数据库迁移：为缩略图元数据补充独立 processor namespace。

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum FileBlobs {
    Table,
    ThumbnailProcessor,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(FileBlobs::Table)
                    .add_column(
                        ColumnDef::new(FileBlobs::ThumbnailProcessor)
                            .string_len(32)
                            .null(),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(FileBlobs::Table)
                    .drop_column(FileBlobs::ThumbnailProcessor)
                    .to_owned(),
            )
            .await
    }
}
