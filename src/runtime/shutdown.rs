use sea_orm::DatabaseConnection;
use tokio::signal;

/// 等待 Ctrl-C 信号，然后进行优雅关闭
pub async fn wait_for_signal() {
    signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    tracing::info!("received shutdown signal, shutting down gracefully...");
}

/// 执行关闭流程：关闭数据库连接并记录日志
pub async fn perform_shutdown(db: DatabaseConnection) {
    tracing::info!("closing database connection...");
    if let Err(e) = db.close().await {
        tracing::error!("error closing database connection: {}", e);
    } else {
        tracing::info!("database connection closed");
    }
    tracing::info!("shutdown complete");
}
