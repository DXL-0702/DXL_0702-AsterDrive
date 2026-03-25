#[macro_use]
mod common;

use actix_web::test;
use serde_json::Value;

#[actix_web::test]
async fn test_trash_restore_purge() {
    let state = common::setup().await;
    let app = create_test_app!(state);

    let (token, _) = register_and_login!(app);
    let file_id = upload_test_file!(app, token);

    // 软删除
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 列出回收站
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 1);

    // 恢复
    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/trash/file/{file_id}/restore"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 文件可访问
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 再次软删除 → purge 永久删除
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    test::call_service(&app, req).await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/trash/file/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 回收站为空
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);
}

#[actix_web::test]
async fn test_trash_purge_all() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 上传两个文件
    let f1 = upload_test_file!(app, token);
    // 第二个用不同名字
    let boundary = "----TestBoundary123";
    let payload = "------TestBoundary123\r\n\
         Content-Disposition: form-data; name=\"file\"; filename=\"second.txt\"\r\n\
         Content-Type: text/plain\r\n\r\n\
         second\r\n\
         ------TestBoundary123--\r\n";
    let req = test::TestRequest::post()
        .uri("/api/v1/files/upload")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .insert_header((
            "Content-Type",
            format!("multipart/form-data; boundary={boundary}"),
        ))
        .set_payload(payload)
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201);
    let body: Value = test::read_body_json(resp).await;
    let f2 = body["data"]["id"].as_i64().unwrap();

    // 软删除两个
    for fid in [f1, f2] {
        let req = test::TestRequest::delete()
            .uri(&format!("/api/v1/files/{fid}"))
            .insert_header(("Cookie", format!("aster_access={token}")))
            .to_request();
        test::call_service(&app, req).await;
    }

    // 回收站有 2 个
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 2);

    // purge all
    let req = test::TestRequest::delete()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 回收站为空
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);
}

/// 测试嵌套文件夹的 purge：删除顶层文件夹后 purge，子文件夹和子文件都应被彻底清理
#[actix_web::test]
async fn test_purge_nested_folder_cleans_children() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 创建 parent/child 文件夹结构
    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "parent" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let parent_id = body["data"]["id"].as_i64().unwrap();

    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "child", "parent_id": parent_id }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let child_id = body["data"]["id"].as_i64().unwrap();

    // 在 child 内上传文件
    let file_id = upload_test_file_to_folder!(app, token, child_id);

    // 软删除顶层文件夹（会递归标记 child 和文件）
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/folders/{parent_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // purge 顶层文件夹
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/trash/folder/{parent_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 回收站完全为空（子文件夹和子文件都已递归清理）
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["folders"].as_array().unwrap().len(), 0);
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);

    // 子文件应已被硬删除（404）
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.status(),
        404,
        "child file should be permanently deleted"
    );
}

/// 测试 purge_all 三层嵌套：所有子项都应被清理
#[actix_web::test]
async fn test_purge_all_nested_no_orphans() {
    let state = common::setup().await;
    let app = create_test_app!(state);
    let (token, _) = register_and_login!(app);

    // 创建 A/B/C 三层嵌套
    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "A" }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let a_id = body["data"]["id"].as_i64().unwrap();

    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "B", "parent_id": a_id }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let b_id = body["data"]["id"].as_i64().unwrap();

    let req = test::TestRequest::post()
        .uri("/api/v1/folders")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .set_json(serde_json::json!({ "name": "C", "parent_id": b_id }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    let c_id = body["data"]["id"].as_i64().unwrap();

    // 每层各上传一个文件
    upload_test_file_to_folder!(app, token, a_id);
    upload_test_file_to_folder!(app, token, b_id);
    let c_file_id = upload_test_file_to_folder!(app, token, c_id);

    // 根目录散文件
    let root_file_id = upload_test_file!(app, token);

    // 软删除 A + 散文件
    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/folders/{a_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    test::call_service(&app, req).await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/files/{root_file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    test::call_service(&app, req).await;

    // purge all
    let req = test::TestRequest::delete()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200);

    // 回收站完全为空
    let req = test::TestRequest::get()
        .uri("/api/v1/trash")
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["data"]["folders"].as_array().unwrap().len(), 0);
    assert_eq!(body["data"]["files"].as_array().unwrap().len(), 0);

    // 最深层文件也应 404
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/files/{c_file_id}"))
        .insert_header(("Cookie", format!("aster_access={token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 404);
}
