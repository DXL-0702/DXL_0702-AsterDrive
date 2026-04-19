//! 数据库迁移：`create_auth_sessions`。

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum AuthSessions {
    Table,
    Id,
    UserId,
    CurrentRefreshJti,
    PreviousRefreshJti,
    RefreshExpiresAt,
    IpAddress,
    UserAgent,
    CreatedAt,
    LastSeenAt,
    RevokedAt,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AuthSessions::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(AuthSessions::Id)
                            .string_len(36)
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(AuthSessions::UserId)
                            .big_integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AuthSessions::CurrentRefreshJti)
                            .string_len(36)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(AuthSessions::PreviousRefreshJti)
                            .string_len(36)
                            .null(),
                    )
                    .col(
                        crate::time::utc_date_time_column(manager, AuthSessions::RefreshExpiresAt)
                            .not_null(),
                    )
                    .col(ColumnDef::new(AuthSessions::IpAddress).text().null())
                    .col(ColumnDef::new(AuthSessions::UserAgent).text().null())
                    .col(
                        crate::time::utc_date_time_column(manager, AuthSessions::CreatedAt)
                            .not_null(),
                    )
                    .col(
                        crate::time::utc_date_time_column(manager, AuthSessions::LastSeenAt)
                            .not_null(),
                    )
                    .col(crate::time::utc_date_time_column(manager, AuthSessions::RevokedAt).null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(AuthSessions::Table, AuthSessions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_auth_sessions_user_id")
                    .table(AuthSessions::Table)
                    .col(AuthSessions::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_auth_sessions_current_refresh_jti")
                    .table(AuthSessions::Table)
                    .col(AuthSessions::CurrentRefreshJti)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_auth_sessions_refresh_expires_at")
                    .table(AuthSessions::Table)
                    .col(AuthSessions::RefreshExpiresAt)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_auth_sessions_previous_refresh_jti")
                    .table(AuthSessions::Table)
                    .col(AuthSessions::PreviousRefreshJti)
                    .to_owned(),
            )
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AuthSessions::Table).to_owned())
            .await
    }
}
