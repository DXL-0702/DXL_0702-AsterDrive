use std::future::Future;
use std::time::Duration;

use actix_web::web;

use super::AppState;

/// Spawn a periodic background task with panic recovery.
///
/// Each iteration runs in a child `tokio::spawn` so that a panic is caught
/// by the `JoinHandle` instead of killing the loop. On panic the error is
/// logged and the next interval fires normally.
fn spawn_periodic<F, Fut>(
    name: &'static str,
    interval: Duration,
    state: web::Data<AppState>,
    task_fn: F,
) where
    F: Fn(web::Data<AppState>) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(interval);
        loop {
            ticker.tick().await;
            let s = state.clone();
            if let Err(e) = tokio::spawn(task_fn(s)).await {
                tracing::error!("background task '{name}' panicked: {e}");
            }
        }
    });
}

/// Spawn all periodic background cleanup tasks.
pub fn spawn_background_tasks(state: web::Data<AppState>) {
    let hourly = Duration::from_secs(3600);

    spawn_periodic("upload-cleanup", hourly, state.clone(), |s| async move {
        if let Err(e) = crate::services::upload_service::cleanup_expired(&s).await {
            tracing::warn!("upload cleanup failed: {e}");
        }
    });

    spawn_periodic("trash-cleanup", hourly, state.clone(), |s| async move {
        if let Err(e) = crate::services::trash_service::cleanup_expired(&s).await {
            tracing::warn!("trash cleanup failed: {e}");
        }
    });

    spawn_periodic("lock-cleanup", hourly, state.clone(), |s| async move {
        match crate::services::lock_service::cleanup_expired(&s).await {
            Ok(n) if n > 0 => tracing::info!("cleaned up {n} expired locks"),
            Err(e) => tracing::warn!("lock cleanup failed: {e}"),
            _ => {}
        }
    });

    spawn_periodic("audit-cleanup", hourly, state, |s| async move {
        if let Err(e) = crate::services::audit_service::cleanup_expired(&s).await {
            tracing::warn!("audit log cleanup failed: {e}");
        }
    });
}
