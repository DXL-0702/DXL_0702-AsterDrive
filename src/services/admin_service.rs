use chrono::{DateTime, Duration, LocalResult, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use sea_orm::{
    ColumnTrait, EntityTrait, ExprTrait, PaginatorTrait, QueryFilter, QuerySelect, sea_query::Expr,
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

use crate::entities::{
    audit_log::{self, Entity as AuditLog},
    file::{self, Entity as File},
    file_blob::Entity as FileBlob,
    share::Entity as Share,
    user::{self, Entity as User},
};
use crate::errors::{AsterError, Result};
use crate::runtime::AppState;
use crate::services::audit_service;
use crate::types::UserStatus;

type DateTimeUtc = DateTime<Utc>;

const DEFAULT_DAYS: u32 = 7;
const MAX_DAYS: u32 = 90;
const DEFAULT_EVENT_LIMIT: u64 = 8;
const MAX_EVENT_LIMIT: u64 = 50;
const DEFAULT_TIMEZONE: &str = "UTC";

#[derive(Clone, Debug, Deserialize, IntoParams)]
pub struct AdminOverviewQuery {
    pub days: Option<u32>,
    pub timezone: Option<String>,
    pub event_limit: Option<u64>,
}

impl AdminOverviewQuery {
    pub fn days_or_default(&self) -> u32 {
        self.days
            .map(|days| days.clamp(1, MAX_DAYS))
            .unwrap_or(DEFAULT_DAYS)
    }

    pub fn event_limit_or_default(&self) -> u64 {
        self.event_limit
            .map(|limit| limit.clamp(1, MAX_EVENT_LIMIT))
            .unwrap_or(DEFAULT_EVENT_LIMIT)
    }

    pub fn timezone_name(&self) -> &str {
        self.timezone
            .as_deref()
            .filter(|timezone| !timezone.trim().is_empty())
            .unwrap_or(DEFAULT_TIMEZONE)
    }
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct AdminOverviewStats {
    pub total_users: u64,
    pub active_users: u64,
    pub disabled_users: u64,
    pub total_files: u64,
    pub total_file_bytes: i64,
    pub total_blobs: u64,
    pub total_blob_bytes: i64,
    pub total_shares: u64,
    pub audit_events_today: u64,
    pub new_users_today: u64,
    pub uploads_today: u64,
    pub shares_today: u64,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct AdminOverviewDailyReport {
    pub date: String,
    pub sign_ins: u64,
    pub new_users: u64,
    pub uploads: u64,
    pub share_creations: u64,
    pub deletions: u64,
    pub total_events: u64,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
pub struct AdminOverview {
    #[schema(value_type = String)]
    pub generated_at: DateTimeUtc,
    pub timezone: String,
    pub days: u32,
    pub stats: AdminOverviewStats,
    pub daily_reports: Vec<AdminOverviewDailyReport>,
    pub recent_events: Vec<audit_log::Model>,
}

pub async fn get_overview(
    state: &AppState,
    days: u32,
    timezone_name: &str,
    event_limit: u64,
) -> Result<AdminOverview> {
    let generated_at = Utc::now();
    let timezone = parse_timezone(timezone_name)?;
    let today = generated_at.with_timezone(&timezone).date_naive();

    let total_users = User::find().count(&state.db).await?;
    let active_users = User::find()
        .filter(user::Column::Status.eq(UserStatus::Active))
        .count(&state.db)
        .await?;
    let disabled_users = User::find()
        .filter(user::Column::Status.eq(UserStatus::Disabled))
        .count(&state.db)
        .await?;

    let total_files = File::find()
        .filter(file::Column::DeletedAt.is_null())
        .count(&state.db)
        .await?;
    let total_file_bytes = sum_live_file_bytes(state).await?;
    let total_blobs = FileBlob::find().count(&state.db).await?;
    let total_blob_bytes = sum_blob_bytes(state).await?;
    let total_shares = Share::find().count(&state.db).await?;

    let daily_reports = build_daily_reports(state, today, days, timezone).await?;
    let today_report = daily_reports
        .first()
        .cloned()
        .unwrap_or(AdminOverviewDailyReport {
            date: today.to_string(),
            sign_ins: 0,
            new_users: 0,
            uploads: 0,
            share_creations: 0,
            deletions: 0,
            total_events: 0,
        });
    let recent_events = audit_service::query(
        state,
        audit_service::AuditLogFilters {
            user_id: None,
            action: None,
            entity_type: None,
            after: None,
            before: None,
        },
        event_limit,
        0,
    )
    .await?
    .items;

    Ok(AdminOverview {
        generated_at,
        timezone: timezone.name().to_string(),
        days,
        stats: AdminOverviewStats {
            total_users,
            active_users,
            disabled_users,
            total_files,
            total_file_bytes,
            total_blobs,
            total_blob_bytes,
            total_shares,
            audit_events_today: today_report.total_events,
            new_users_today: today_report.new_users,
            uploads_today: today_report.uploads,
            shares_today: today_report.share_creations,
        },
        daily_reports,
        recent_events,
    })
}

async fn build_daily_reports(
    state: &AppState,
    today: NaiveDate,
    days: u32,
    timezone: Tz,
) -> Result<Vec<AdminOverviewDailyReport>> {
    let mut reports = Vec::with_capacity(days as usize);

    for offset in 0..days {
        let date = today - Duration::days(offset as i64);
        let start = start_of_local_day(date, timezone)?;
        let end = start_of_local_day(date + Duration::days(1), timezone)?;

        let sign_ins = count_audit_events_between(
            &state.db,
            start,
            end,
            &[audit_service::AuditAction::UserLogin],
        )
        .await?;
        let new_users = count_audit_events_between(
            &state.db,
            start,
            end,
            &[
                audit_service::AuditAction::UserRegister,
                audit_service::AuditAction::AdminCreateUser,
            ],
        )
        .await?;
        let uploads = count_audit_events_between(
            &state.db,
            start,
            end,
            &[audit_service::AuditAction::FileUpload],
        )
        .await?;
        let share_creations = count_audit_events_between(
            &state.db,
            start,
            end,
            &[audit_service::AuditAction::ShareCreate],
        )
        .await?;
        let deletions = count_audit_events_between(
            &state.db,
            start,
            end,
            &[
                audit_service::AuditAction::BatchDelete,
                audit_service::AuditAction::FileDelete,
                audit_service::AuditAction::FolderDelete,
            ],
        )
        .await?;
        let total_events = count_audit_events_between(&state.db, start, end, &[]).await?;

        reports.push(AdminOverviewDailyReport {
            date: date.to_string(),
            sign_ins,
            new_users,
            uploads,
            share_creations,
            deletions,
            total_events,
        });
    }

    reports.sort_by(|left, right| right.date.cmp(&left.date));

    Ok(reports)
}

async fn count_audit_events_between(
    db: &sea_orm::DatabaseConnection,
    start: DateTimeUtc,
    end: DateTimeUtc,
    actions: &[audit_service::AuditAction],
) -> Result<u64> {
    let mut query = AuditLog::find()
        .filter(audit_log::Column::CreatedAt.gte(start))
        .filter(audit_log::Column::CreatedAt.lt(end));

    if !actions.is_empty() {
        let action_names: Vec<&str> = actions.iter().map(|action| action.as_str()).collect();
        query = query.filter(audit_log::Column::Action.is_in(action_names));
    }

    Ok(query.count(db).await?)
}

async fn sum_live_file_bytes(state: &AppState) -> Result<i64> {
    Ok(File::find()
        .select_only()
        .column_as(Expr::col(file::Column::Size).sum(), "sum")
        .filter(file::Column::DeletedAt.is_null())
        .into_tuple::<Option<i64>>()
        .one(&state.db)
        .await?
        .flatten()
        .unwrap_or(0))
}

async fn sum_blob_bytes(state: &AppState) -> Result<i64> {
    Ok(FileBlob::find()
        .select_only()
        .column_as(
            Expr::col(crate::entities::file_blob::Column::Size).sum(),
            "sum",
        )
        .into_tuple::<Option<i64>>()
        .one(&state.db)
        .await?
        .flatten()
        .unwrap_or(0))
}

fn parse_timezone(timezone_name: &str) -> Result<Tz> {
    timezone_name
        .parse::<Tz>()
        .map_err(|_| AsterError::validation_error(format!("invalid timezone '{timezone_name}'")))
}

fn start_of_local_day(date: NaiveDate, timezone: Tz) -> Result<DateTimeUtc> {
    let naive = date
        .and_hms_opt(0, 0, 0)
        .expect("start of day should always be valid");
    match timezone.from_local_datetime(&naive) {
        LocalResult::Single(dt) => Ok(dt.with_timezone(&Utc)),
        LocalResult::Ambiguous(earliest, _) => Ok(earliest.with_timezone(&Utc)),
        LocalResult::None => Err(AsterError::validation_error(format!(
            "timezone '{}' cannot represent local midnight for {}",
            timezone.name(),
            date
        ))),
    }
}
