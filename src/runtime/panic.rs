use std::fs::OpenOptions;
use std::io::Write;
use std::panic;

/// 安装自定义 panic hook，将崩溃信息写入 crash.log 并输出到 stderr
pub fn install_panic_hook() {
    panic::set_hook(Box::new(|info| {
        let thread = std::thread::current();
        let thread_name = thread.name().unwrap_or("<unnamed>");

        let location = info
            .location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "<unknown>".to_string());

        let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "<no message>".to_string()
        };

        let backtrace = std::backtrace::Backtrace::force_capture();
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");

        let crash_report = format!(
            "=== PANIC ===\n\
             Timestamp: {timestamp}\n\
             Thread:    {thread_name}\n\
             Location:  {location}\n\
             Message:   {message}\n\
             Backtrace:\n{backtrace}\n\
             =============\n\n"
        );

        // 写入 crash.log
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open("crash.log")
        {
            let _ = file.write_all(crash_report.as_bytes());
        }

        // 输出到 stderr
        eprintln!("[PANIC] thread '{thread_name}' at {location}: {message}");
    }));
}
