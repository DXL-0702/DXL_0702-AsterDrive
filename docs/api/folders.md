# 文件夹 API

所有接口需要认证。

## GET /folders

列出根目录下的文件夹和文件。

**响应：** `200` 返回 `{ folders: [...], files: [...] }`。

## POST /folders

创建文件夹。

**请求体：**

```json
{ "name": "Documents", "parent_id": null }
```

`parent_id` 为 `null` 表示在根目录下创建。

## GET /folders/{id} {#get-folder}

列出指定文件夹的内容。

## PATCH /folders/{id} {#patch-folder}

修改文件夹属性。

**请求体：**

```json
{ "name": "新名称", "parent_id": 3, "policy_id": 2 }
```

所有字段可选。`policy_id` 可覆盖该文件夹的存储策略。

## DELETE /folders/{id} {#delete-folder}

删除文件夹及其所有内容。
