#[macro_use]
mod common;

use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement};

async fn explain_query_plan(db: &DatabaseConnection, sql: &str) -> Vec<String> {
    db.query_all_raw(Statement::from_string(
        DbBackend::Sqlite,
        format!("EXPLAIN QUERY PLAN {sql}"),
    ))
    .await
    .unwrap()
    .into_iter()
    .map(|row| row.try_get_by_index::<String>(3).unwrap())
    .collect()
}

fn assert_uses_index(plan: &[String], index: &str, table: &str) {
    assert!(
        plan.iter().any(|detail| detail.contains(index)),
        "expected planner to use {index}, got {plan:?}"
    );
    assert!(
        !plan
            .iter()
            .any(|detail| detail.contains(&format!("SCAN {table}"))),
        "expected planner to avoid scanning {table}, got {plan:?}"
    );
}

fn assert_no_temp_btree(plan: &[String]) {
    assert!(
        !plan
            .iter()
            .any(|detail| detail.contains("USE TEMP B-TREE FOR ORDER BY")),
        "expected planner to avoid temp ORDER BY b-tree, got {plan:?}"
    );
}

#[actix_web::test]
async fn test_directory_lookup_indexes_cover_listing_and_duplicate_name_queries() {
    let state = common::setup().await;

    let folder_listing = explain_query_plan(
        &state.db,
        "SELECT * FROM folders \
         WHERE user_id = 1 AND deleted_at IS NULL AND parent_id = 2 \
         ORDER BY name",
    )
    .await;
    assert_uses_index(
        &folder_listing,
        "idx_folders_user_deleted_parent_name",
        "folders",
    );
    assert_no_temp_btree(&folder_listing);

    let file_listing = explain_query_plan(
        &state.db,
        "SELECT * FROM files \
         WHERE user_id = 1 AND deleted_at IS NULL AND folder_id = 2 \
         ORDER BY name",
    )
    .await;
    assert_uses_index(&file_listing, "idx_files_user_deleted_folder_name", "files");
    assert_no_temp_btree(&file_listing);

    let folder_duplicate = explain_query_plan(
        &state.db,
        "SELECT * FROM folders \
         WHERE user_id = 1 AND name = 'dup' AND deleted_at IS NULL AND parent_id = 2",
    )
    .await;
    assert_uses_index(
        &folder_duplicate,
        "idx_folders_user_deleted_parent_name",
        "folders",
    );

    let file_duplicate = explain_query_plan(
        &state.db,
        "SELECT * FROM files \
         WHERE user_id = 1 AND name = 'dup' AND deleted_at IS NULL AND folder_id = 2",
    )
    .await;
    assert_uses_index(
        &file_duplicate,
        "idx_files_user_deleted_folder_name",
        "files",
    );
}

#[actix_web::test]
async fn test_trash_pagination_indexes_cover_deleted_item_queries() {
    let state = common::setup().await;

    let folder_trash = explain_query_plan(
        &state.db,
        "SELECT * FROM folders \
         WHERE user_id = 1 \
           AND deleted_at IS NOT NULL \
           AND (parent_id IS NULL OR NOT EXISTS ( \
                SELECT 1 FROM folders p \
                WHERE p.id = folders.parent_id AND p.deleted_at IS NOT NULL \
           )) \
         ORDER BY deleted_at DESC \
         LIMIT 50 OFFSET 0",
    )
    .await;
    assert_uses_index(&folder_trash, "idx_folders_user_deleted_at_id", "folders");
    assert_no_temp_btree(&folder_trash);

    let file_trash = explain_query_plan(
        &state.db,
        "SELECT * FROM files \
         WHERE user_id = 1 \
           AND deleted_at IS NOT NULL \
           AND (folder_id IS NULL OR NOT EXISTS ( \
                SELECT 1 FROM folders f2 \
                WHERE f2.id = files.folder_id AND f2.deleted_at IS NOT NULL \
           )) \
         ORDER BY deleted_at DESC, id ASC \
         LIMIT 50",
    )
    .await;
    assert_uses_index(&file_trash, "idx_files_user_deleted_at_id", "files");
    assert_no_temp_btree(&file_trash);
}
