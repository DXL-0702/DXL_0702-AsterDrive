use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

/// 当前堆分配字节数
pub static ALLOCATED: AtomicUsize = AtomicUsize::new(0);
/// 历史峰值
pub static PEAK: AtomicUsize = AtomicUsize::new(0);

pub struct TrackingAlloc;

unsafe impl GlobalAlloc for TrackingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = unsafe { System.alloc(layout) };
        if !ptr.is_null() {
            let current = ALLOCATED.fetch_add(layout.size(), Ordering::Relaxed) + layout.size();
            PEAK.fetch_max(current, Ordering::Relaxed);
        }
        ptr
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        ALLOCATED.fetch_sub(layout.size(), Ordering::Relaxed);
        unsafe { System.dealloc(ptr, layout) };
    }
}

/// 获取当前分配量和峰值（MB）
pub fn stats() -> (f64, f64) {
    let allocated = ALLOCATED.load(Ordering::Relaxed) as f64 / 1_048_576.0;
    let peak = PEAK.load(Ordering::Relaxed) as f64 / 1_048_576.0;
    (allocated, peak)
}
