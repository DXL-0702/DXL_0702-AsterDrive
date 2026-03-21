//! Prometheus 指标模块（仅 `metrics` feature 启用时编译）
//!
//! 架构参考 shortlinker-backend：OnceLock 全局单例 + init/get 模式

#[cfg(feature = "metrics")]
mod inner {
    use prometheus::{
        Encoder, Gauge, HistogramOpts, HistogramVec, IntCounter, IntCounterVec, Opts, Registry,
        TextEncoder,
    };
    use std::sync::OnceLock;

    static METRICS: OnceLock<Metrics> = OnceLock::new();

    pub struct Metrics {
        pub registry: Registry,

        // HTTP 请求
        pub http_requests_total: IntCounterVec,
        pub http_request_duration_seconds: HistogramVec,

        // 业务
        pub file_uploads_total: IntCounter,
        pub file_downloads_total: IntCounter,

        // 系统
        pub process_memory_rss_bytes: Gauge,
        pub process_cpu_seconds: Gauge,
        pub uptime_seconds: Gauge,
    }

    impl Metrics {
        fn new() -> Result<Self, prometheus::Error> {
            let registry = Registry::new();

            let http_requests_total = IntCounterVec::new(
                Opts::new("http_requests_total", "Total HTTP requests"),
                &["method", "status"],
            )?;
            let http_request_duration_seconds = HistogramVec::new(
                HistogramOpts::new(
                    "http_request_duration_seconds",
                    "HTTP request duration in seconds",
                )
                .buckets(vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 5.0]),
                &["method"],
            )?;

            let file_uploads_total = IntCounter::new("file_uploads_total", "Total file uploads")?;
            let file_downloads_total =
                IntCounter::new("file_downloads_total", "Total file downloads")?;

            let process_memory_rss_bytes =
                Gauge::new("process_memory_rss_bytes", "Process RSS memory in bytes")?;
            let process_cpu_seconds =
                Gauge::new("process_cpu_seconds_total", "Process CPU time in seconds")?;
            let uptime_seconds = Gauge::new("process_uptime_seconds", "Process uptime in seconds")?;

            registry.register(Box::new(http_requests_total.clone()))?;
            registry.register(Box::new(http_request_duration_seconds.clone()))?;
            registry.register(Box::new(file_uploads_total.clone()))?;
            registry.register(Box::new(file_downloads_total.clone()))?;
            registry.register(Box::new(process_memory_rss_bytes.clone()))?;
            registry.register(Box::new(process_cpu_seconds.clone()))?;
            registry.register(Box::new(uptime_seconds.clone()))?;

            Ok(Metrics {
                registry,
                http_requests_total,
                http_request_duration_seconds,
                file_uploads_total,
                file_downloads_total,
                process_memory_rss_bytes,
                process_cpu_seconds,
                uptime_seconds,
            })
        }

        pub fn export(&self) -> Result<String, String> {
            let encoder = TextEncoder::new();
            let metric_families = self.registry.gather();
            let mut buf = Vec::new();
            encoder
                .encode(&metric_families, &mut buf)
                .map_err(|e| e.to_string())?;
            String::from_utf8(buf).map_err(|e| e.to_string())
        }
    }

    pub fn init_metrics() -> Result<(), prometheus::Error> {
        let metrics = Metrics::new()?;
        METRICS
            .set(metrics)
            .map_err(|_| prometheus::Error::Msg("metrics already initialized".to_string()))
    }

    pub fn get_metrics() -> Option<&'static Metrics> {
        METRICS.get()
    }

    /// 后台任务：定期更新系统指标（RSS、CPU）
    pub fn spawn_system_metrics_updater() {
        use std::sync::Mutex;
        use sysinfo::{Pid, ProcessesToUpdate, System};

        static SYSTEM: OnceLock<Mutex<System>> = OnceLock::new();

        tokio::spawn(async {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
            loop {
                interval.tick().await;
                let Some(metrics) = get_metrics() else {
                    continue;
                };
                let pid = Pid::from_u32(std::process::id());
                let sys_mutex = SYSTEM.get_or_init(|| Mutex::new(System::new()));
                let mut sys = sys_mutex.lock().unwrap_or_else(|p| p.into_inner());
                sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
                if let Some(process) = sys.process(pid) {
                    metrics
                        .process_memory_rss_bytes
                        .set(process.memory() as f64);
                    let cpu_secs = process.run_time() as f64;
                    metrics.process_cpu_seconds.set(cpu_secs);
                }
            }
        });
    }
}

#[cfg(feature = "metrics")]
pub use inner::*;
