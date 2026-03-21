pub mod hash;
pub mod id;

/// 临时文件目录（上传流式处理用）
pub const TEMP_DIR: &str = "data/.tmp";

/// macOS / Office 生成的隐藏文件名，不在目录列表中显示
pub fn is_hidden_name(name: &str) -> bool {
    name.starts_with("._")
        || name.starts_with("~$")
        || name == ".DS_Store"
        || name == ".Spotlight-V100"
        || name == ".Trashes"
}

/// 生成副本名称（macOS/Windows 风格）
///
/// 规则：
/// - `test.txt` → `test (1).txt`
/// - `test (1).txt` → `test (2).txt`
/// - `test (99).txt` → `test (100).txt`
/// - `folder` → `folder (1)` （无扩展名）
/// - `folder (3)` → `folder (4)`
pub fn next_copy_name(name: &str) -> String {
    // 分离扩展名
    let (stem, ext) = match name.rfind('.') {
        Some(dot) if dot > 0 => (&name[..dot], Some(&name[dot..])),
        _ => (name, None),
    };

    // 检查 stem 是否已经有 " (N)" 后缀
    let (base, next_n) = if let Some(paren_start) = stem.rfind(" (") {
        let after_paren = &stem[paren_start + 2..];
        if let Some(num_str) = after_paren.strip_suffix(')') {
            if let Ok(n) = num_str.parse::<u32>() {
                (&stem[..paren_start], n + 1)
            } else {
                (stem, 1)
            }
        } else {
            (stem, 1)
        }
    } else {
        (stem, 1)
    };

    match ext {
        Some(ext) => format!("{base} ({next_n}){ext}"),
        None => format!("{base} ({next_n})"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_hidden_name() {
        assert!(is_hidden_name("._file.txt"));
        assert!(is_hidden_name("~$document.docx"));
        assert!(is_hidden_name(".DS_Store"));
        assert!(is_hidden_name(".Spotlight-V100"));
        assert!(is_hidden_name(".Trashes"));
        assert!(!is_hidden_name("normal.txt"));
    }

    #[test]
    fn test_next_copy_name() {
        assert_eq!(next_copy_name("test.txt"), "test (1).txt");
        assert_eq!(next_copy_name("test (1).txt"), "test (2).txt");
        assert_eq!(next_copy_name("test (99).txt"), "test (100).txt");
        assert_eq!(next_copy_name("folder"), "folder (1)");
        assert_eq!(next_copy_name("folder (3)"), "folder (4)");
        assert_eq!(next_copy_name("my.file.tar.gz"), "my.file.tar (1).gz");
        assert_eq!(next_copy_name("photo (1).jpg"), "photo (2).jpg");
        assert_eq!(next_copy_name(".hidden"), ".hidden (1)");
    }
}
