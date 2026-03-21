use std::io::Cursor;
use std::time::{Duration, SystemTime};

use chrono::Utc;
use dav_server::davpath::DavPath;
use dav_server::ls::{DavLock, DavLockSystem};
use sea_orm::{DatabaseConnection, Set};
use xmltree::Element;

use crate::db::repository::webdav_lock_repo;
use crate::entities::webdav_lock;

/// 数据库支持的 WebDAV 锁系统，替代 MemLs
#[derive(Debug, Clone)]
pub struct DbLockSystem {
    db: DatabaseConnection,
}

impl DbLockSystem {
    pub fn new(db: DatabaseConnection) -> Box<Self> {
        Box::new(Self { db })
    }
}

type LsFuture<'a, T> = std::pin::Pin<Box<dyn std::future::Future<Output = T> + Send + 'a>>;

impl DavLockSystem for DbLockSystem {
    fn lock(
        &self,
        path: &DavPath,
        principal: Option<&str>,
        owner: Option<&Element>,
        timeout: Option<Duration>,
        shared: bool,
        deep: bool,
    ) -> LsFuture<'_, Result<DavLock, DavLock>> {
        let path_str = normalize_path(path);
        let path_owned = path.clone();
        let principal_owned = principal.map(|s| s.to_string());
        let owner_xml = owner.map(serialize_element);
        let owner_clone = owner.cloned();
        let timeout_dur = timeout;

        Box::pin(async move {
            // 检查冲突：查询路径上的所有锁
            let ancestor_paths = path_ancestors(&path_str);
            let ancestor_locks = webdav_lock_repo::find_ancestors(&self.db, &ancestor_paths)
                .await
                .unwrap_or_default();

            // 检查路径上的冲突锁
            let now = Utc::now();
            for lock in &ancestor_locks {
                // 跳过过期锁
                if let Some(timeout_at) = lock.timeout_at
                    && timeout_at < now
                {
                    continue;
                }

                // 如果锁在目标路径或祖先路径上
                let lock_is_ancestor = lock.path != path_str;

                // 祖先上的浅锁不影响子路径
                if lock_is_ancestor && !lock.deep {
                    continue;
                }

                // 排他锁冲突
                if !lock.shared || !shared {
                    return Err(model_to_dav_lock(lock));
                }
            }

            // 如果 deep=true，还要检查子路径上的冲突锁
            if deep {
                let descendant_locks = webdav_lock_repo::find_by_path_prefix(&self.db, &path_str)
                    .await
                    .unwrap_or_default();

                for lock in &descendant_locks {
                    if let Some(timeout_at) = lock.timeout_at
                        && timeout_at < now
                    {
                        continue;
                    }
                    if !lock.shared || !shared {
                        return Err(model_to_dav_lock(lock));
                    }
                }
            }

            // 无冲突，创建新锁
            let token = format!("urn:uuid:{}", uuid::Uuid::new_v4());
            let timeout_at = timeout_dur.map(|d| now + chrono::Duration::from_std(d).unwrap());

            let model = webdav_lock::ActiveModel {
                token: Set(token.clone()),
                path: Set(path_str.clone()),
                principal: Set(principal_owned.clone()),
                owner_xml: Set(owner_xml),
                timeout_at: Set(timeout_at),
                shared: Set(shared),
                deep: Set(deep),
                created_at: Set(now),
                ..Default::default()
            };

            webdav_lock_repo::create(&self.db, model)
                .await
                .map_err(|_| DavLock {
                    token: String::new(),
                    path: Box::new(path_owned.clone()),
                    principal: None,
                    owner: None,
                    timeout_at: None,
                    timeout: None,
                    shared: false,
                    deep: false,
                })?;

            Ok(DavLock {
                token,
                path: Box::new(path_owned),
                principal: principal_owned,
                owner: owner_clone.map(Box::new),
                timeout_at: timeout_dur.map(|d| SystemTime::now() + d),
                timeout: timeout_dur,
                shared,
                deep,
            })
        })
    }

    fn unlock(&self, _path: &DavPath, token: &str) -> LsFuture<'_, Result<(), ()>> {
        let token_owned = token.to_string();
        Box::pin(async move {
            webdav_lock_repo::delete_by_token(&self.db, &token_owned)
                .await
                .map_err(|_| ())
        })
    }

    fn refresh(
        &self,
        path: &DavPath,
        token: &str,
        timeout: Option<Duration>,
    ) -> LsFuture<'_, Result<DavLock, ()>> {
        let token_owned = token.to_string();
        let path_clone = path.clone();
        let timeout_dur = timeout;

        Box::pin(async move {
            let now = Utc::now();
            let new_timeout_at = timeout_dur.map(|d| now + chrono::Duration::from_std(d).unwrap());

            let lock = webdav_lock_repo::refresh(&self.db, &token_owned, new_timeout_at)
                .await
                .map_err(|_| ())?
                .ok_or(())?;

            Ok(DavLock {
                token: lock.token,
                path: Box::new(path_clone),
                principal: lock.principal,
                owner: lock
                    .owner_xml
                    .as_deref()
                    .and_then(deserialize_element)
                    .map(Box::new),
                timeout_at: timeout_dur.map(|d| SystemTime::now() + d),
                timeout: timeout_dur,
                shared: lock.shared,
                deep: lock.deep,
            })
        })
    }

    fn check(
        &self,
        path: &DavPath,
        principal: Option<&str>,
        ignore_principal: bool,
        deep: bool,
        submitted_tokens: &[String],
    ) -> LsFuture<'_, Result<(), DavLock>> {
        let path_str = normalize_path(path);
        let principal_owned = principal.map(|s| s.to_string());
        let tokens: Vec<String> = submitted_tokens.to_vec();

        Box::pin(async move {
            let now = Utc::now();

            // 1. 查询从根到目标路径的所有祖先锁
            let ancestor_paths = path_ancestors(&path_str);
            let mut all_locks = webdav_lock_repo::find_ancestors(&self.db, &ancestor_paths)
                .await
                .unwrap_or_default();

            // 2. 如果 deep=true，还查后代路径的锁
            if deep {
                let descendants = webdav_lock_repo::find_by_path_prefix(&self.db, &path_str)
                    .await
                    .unwrap_or_default();
                all_locks.extend(descendants);
            }

            // 去重（ancestor + prefix 可能重叠目标路径本身的锁）
            all_locks.sort_by_key(|l| l.id);
            all_locks.dedup_by_key(|l| l.id);

            // RFC4918: 只要在路径链上持有任何一个锁，就视为对目标路径有权限
            // （MemLs 的 holds_lock 状态机语义）
            let holds_any_lock = all_locks.iter().any(|lock| {
                if lock.timeout_at.is_some_and(|t| t < now) {
                    return false;
                }
                let token_held = tokens.contains(&lock.token);
                let principal_ok = ignore_principal
                    || match (&lock.principal, &principal_owned) {
                        (Some(lp), Some(pp)) => lp == pp,
                        (None, _) => true,
                        _ => false,
                    };
                token_held && principal_ok
            });

            if holds_any_lock {
                return Ok(());
            }

            // 没有持有任何锁，检查是否存在冲突锁
            for lock in &all_locks {
                // 跳过过期锁
                if let Some(timeout_at) = lock.timeout_at
                    && timeout_at < now
                {
                    continue;
                }

                // 祖先上的浅锁不影响子路径
                let lock_is_ancestor = lock.path != path_str;
                if lock_is_ancestor && !lock.deep {
                    continue;
                }

                // 后代锁（deep check 查出来的）不受限于非 deep 检查
                let lock_is_descendant = lock.path.starts_with(&path_str) && lock.path != path_str;
                if lock_is_descendant && !deep {
                    continue;
                }

                // 冲突：未持有的活跃锁
                return Err(model_to_dav_lock(lock));
            }

            Ok(())
        })
    }

    fn discover(&self, path: &DavPath) -> LsFuture<'_, Vec<DavLock>> {
        let path_str = normalize_path(path);

        Box::pin(async move {
            let now = Utc::now();

            // 查询路径及祖先的锁
            let ancestor_paths = path_ancestors(&path_str);
            let locks = webdav_lock_repo::find_ancestors(&self.db, &ancestor_paths)
                .await
                .unwrap_or_default();

            locks
                .iter()
                .filter(|l| l.timeout_at.is_none_or(|t| t >= now))
                .map(model_to_dav_lock)
                .collect()
        })
    }

    fn delete(&self, path: &DavPath) -> LsFuture<'_, Result<(), ()>> {
        let path_str = normalize_path(path);
        Box::pin(async move {
            webdav_lock_repo::delete_by_path_prefix(&self.db, &path_str)
                .await
                .map(|_| ())
                .map_err(|_| ())
        })
    }
}

// ── Helpers ─────────────────────────────────────────────────────────

/// 规范化路径：确保以 / 开头
fn normalize_path(path: &DavPath) -> String {
    let raw = String::from_utf8_lossy(path.as_bytes()).to_string();
    if raw.is_empty() || raw == "/" {
        "/".to_string()
    } else {
        raw
    }
}

/// 生成路径的所有祖先列表（含自身）
/// "/a/b/c" → ["/", "/a/", "/a/b/", "/a/b/c"]
fn path_ancestors(path: &str) -> Vec<String> {
    let mut ancestors = vec!["/".to_string()];
    let trimmed = path.trim_start_matches('/');
    let mut current = String::from("/");

    for seg in trimmed.split('/') {
        if seg.is_empty() {
            continue;
        }
        current.push_str(seg);
        current.push('/');
        if current != "/" {
            ancestors.push(current.clone());
        }
    }

    // 也包含不带尾斜线的版本（文件路径没有尾斜线）
    if path != "/" && !path.ends_with('/') {
        ancestors.push(path.to_string());
    }

    ancestors.dedup();
    ancestors
}

fn model_to_dav_lock(lock: &webdav_lock::Model) -> DavLock {
    // 从 DB path 重建 DavPath
    let dav_path = DavPath::new(&lock.path).unwrap_or_else(|_| DavPath::new("/").unwrap());

    DavLock {
        token: lock.token.clone(),
        path: Box::new(dav_path),
        principal: lock.principal.clone(),
        owner: lock
            .owner_xml
            .as_deref()
            .and_then(deserialize_element)
            .map(Box::new),
        timeout_at: lock.timeout_at.map(|t| {
            let dur = (t - Utc::now()).to_std().unwrap_or(Duration::ZERO);
            SystemTime::now() + dur
        }),
        timeout: lock
            .timeout_at
            .map(|t| (t - Utc::now()).to_std().unwrap_or(Duration::ZERO)),
        shared: lock.shared,
        deep: lock.deep,
    }
}

fn serialize_element(elem: &Element) -> String {
    let mut buf = Vec::new();
    elem.write(&mut buf).unwrap_or_default();
    String::from_utf8_lossy(&buf).to_string()
}

fn deserialize_element(xml: &str) -> Option<Element> {
    Element::parse(Cursor::new(xml.as_bytes())).ok()
}
