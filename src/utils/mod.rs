pub mod hash;
pub mod id;

/// macOS / Office 生成的隐藏文件名，不在目录列表中显示
pub fn is_hidden_name(name: &str) -> bool {
    name.starts_with("._")
        || name.starts_with("~$")
        || name == ".DS_Store"
        || name == ".Spotlight-V100"
        || name == ".Trashes"
}
