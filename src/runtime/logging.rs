use crate::config::LoggingConfig;
use tracing_appender::non_blocking::WorkerGuard;

pub struct LoggingInitResult {
    pub guard: WorkerGuard,
    pub warning: Option<String>,
}

pub fn init_logging(config: &LoggingConfig) -> LoggingInitResult {
    // 创建 writer：文件 or stdout
    let (writer, warning): (Box<dyn std::io::Write + Send + Sync>, Option<String>) =
        if !config.file.is_empty() {
            match std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&config.file)
            {
                Ok(file) => (Box::new(file), None),
                Err(e) => (
                    Box::new(std::io::stdout()),
                    Some(format!(
                        "Failed to open log file '{}': {}. Falling back to stdout.",
                        config.file, e
                    )),
                ),
            }
        } else {
            (Box::new(std::io::stdout()), None)
        };

    let (non_blocking_writer, guard) = tracing_appender::non_blocking(writer);

    // 验证 log level
    let mut warning = warning;
    let filter = match tracing_subscriber::EnvFilter::try_from_default_env() {
        Ok(f) => f,
        Err(_) => match tracing_subscriber::EnvFilter::try_new(&config.level) {
            Ok(f) => f,
            Err(e) => {
                let msg = format!(
                    "Invalid logging.level '{}': {}. Falling back to 'info'.",
                    config.level, e
                );
                if let Some(existing) = warning.as_mut() {
                    existing.push(' ');
                    existing.push_str(&msg);
                } else {
                    warning = Some(msg);
                }
                tracing_subscriber::EnvFilter::new("info")
            }
        },
    };

    let is_stdout = config.file.is_empty();

    let builder = tracing_subscriber::fmt()
        .with_writer(non_blocking_writer)
        .with_env_filter(filter)
        .with_level(true)
        .with_ansi(is_stdout);

    if config.format == "json" {
        builder.json().init();
    } else {
        builder.init();
    }

    LoggingInitResult { guard, warning }
}
