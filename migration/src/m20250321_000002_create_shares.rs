use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Shares::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Shares::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Shares::Token)
                            .string_len(32)
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Shares::UserId).big_integer().not_null())
                    .col(ColumnDef::new(Shares::FileId).big_integer().null())
                    .col(ColumnDef::new(Shares::FolderId).big_integer().null())
                    .col(ColumnDef::new(Shares::Password).string_len(255).null())
                    .col(
                        ColumnDef::new(Shares::ExpiresAt)
                            .timestamp_with_time_zone()
                            .null(),
                    )
                    .col(
                        ColumnDef::new(Shares::MaxDownloads)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Shares::DownloadCount)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Shares::ViewCount)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(Shares::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Shares::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Shares::Table, Shares::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // token 索引
        manager
            .create_index(
                Index::create()
                    .name("idx_shares_token")
                    .table(Shares::Table)
                    .col(Shares::Token)
                    .unique()
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Shares::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Shares {
    Table,
    Id,
    Token,
    UserId,
    FileId,
    FolderId,
    Password,
    ExpiresAt,
    MaxDownloads,
    DownloadCount,
    ViewCount,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}
