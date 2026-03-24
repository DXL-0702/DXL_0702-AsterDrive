use super::driver::{BlobMetadata, StorageDriver};
use crate::entities::storage_policy;
use crate::errors::{AsterError, MapAsterErr, Result};
use async_trait::async_trait;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client;
use aws_sdk_s3::config::{BehaviorVersion, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use std::time::Duration;
use tokio::io::AsyncRead;

pub struct S3Driver {
    client: Client,
    bucket: String,
    base_path: String,
}

impl S3Driver {
    pub fn new(policy: &storage_policy::Model) -> Result<Self> {
        let credentials = Credentials::new(
            &policy.access_key,
            &policy.secret_key,
            None,
            None,
            "aster-s3-driver",
        );

        let mut config_builder = aws_sdk_s3::Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("auto"))
            .credentials_provider(credentials)
            .force_path_style(true); // MinIO / R2 等需要

        // 自定义 endpoint（MinIO、R2、OSS 等）
        if !policy.endpoint.is_empty() {
            config_builder = config_builder.endpoint_url(&policy.endpoint);
        }

        let config = config_builder.build();
        let client = Client::from_conf(config);

        let bucket = if policy.bucket.is_empty() {
            return Err(AsterError::storage_driver_error(
                "S3 bucket name is required",
            ));
        } else {
            policy.bucket.clone()
        };

        Ok(Self {
            client,
            bucket,
            base_path: policy.base_path.clone(),
        })
    }

    fn full_key(&self, path: &str) -> String {
        if self.base_path.is_empty() {
            path.trim_start_matches('/').to_string()
        } else {
            format!(
                "{}/{}",
                self.base_path.trim_end_matches('/'),
                path.trim_start_matches('/')
            )
        }
    }
}

#[async_trait]
impl StorageDriver for S3Driver {
    async fn put(&self, path: &str, data: &[u8]) -> Result<String> {
        let key = self.full_key(path);
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(ByteStream::from(data.to_vec()))
            .send()
            .await
            .map_aster_err_ctx("S3 put failed", AsterError::storage_driver_error)?;
        Ok(path.to_string())
    }

    async fn get(&self, path: &str) -> Result<Vec<u8>> {
        let key = self.full_key(path);
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_aster_err_ctx("S3 get failed", AsterError::storage_driver_error)?;

        let bytes = resp
            .body
            .collect()
            .await
            .map_aster_err_ctx("S3 read body failed", AsterError::storage_driver_error)?
            .into_bytes();

        Ok(bytes.to_vec())
    }

    async fn get_stream(&self, path: &str) -> Result<Box<dyn AsyncRead + Unpin + Send>> {
        let key = self.full_key(path);
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_aster_err_ctx("S3 get_stream failed", AsterError::storage_driver_error)?;

        Ok(Box::new(resp.body.into_async_read()))
    }

    async fn delete(&self, path: &str) -> Result<()> {
        let key = self.full_key(path);
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_aster_err_ctx("S3 delete failed", AsterError::storage_driver_error)?;
        Ok(())
    }

    async fn exists(&self, path: &str) -> Result<bool> {
        let key = self.full_key(path);
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(e) => {
                let svc_err = e.into_service_error();
                if svc_err.is_not_found() {
                    Ok(false)
                } else {
                    Err(AsterError::storage_driver_error(format!(
                        "S3 exists check failed: {svc_err}"
                    )))
                }
            }
        }
    }

    async fn metadata(&self, path: &str) -> Result<BlobMetadata> {
        let key = self.full_key(path);
        let resp = self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_aster_err_ctx("S3 head failed", AsterError::storage_driver_error)?;

        Ok(BlobMetadata {
            size: resp.content_length.unwrap_or(0) as u64,
            content_type: resp.content_type,
        })
    }

    async fn put_file(&self, storage_path: &str, local_path: &str) -> Result<String> {
        let key = self.full_key(storage_path);
        let body = ByteStream::from_path(local_path)
            .await
            .map_aster_err_ctx("S3 read file", AsterError::storage_driver_error)?;
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
            .send()
            .await
            .map_aster_err_ctx("S3 put_file failed", AsterError::storage_driver_error)?;
        Ok(storage_path.to_string())
    }

    async fn presigned_url(&self, path: &str, expires: Duration) -> Result<Option<String>> {
        let key = self.full_key(path);
        let presign_config = PresigningConfig::builder()
            .expires_in(expires)
            .build()
            .map_aster_err_ctx("presign config", AsterError::storage_driver_error)?;

        let url = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(presign_config)
            .await
            .map_aster_err_ctx("S3 presigned URL failed", AsterError::storage_driver_error)?;

        Ok(Some(url.uri().to_string()))
    }

    async fn presigned_put_url(&self, path: &str, expires: Duration) -> Result<Option<String>> {
        let key = self.full_key(path);
        let presign_config = PresigningConfig::builder()
            .expires_in(expires)
            .build()
            .map_aster_err_ctx("presign config", AsterError::storage_driver_error)?;

        let url = self
            .client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .presigned(presign_config)
            .await
            .map_aster_err_ctx("S3 presigned PUT failed", AsterError::storage_driver_error)?;

        Ok(Some(url.uri().to_string()))
    }

    async fn copy_object(&self, src_path: &str, dest_path: &str) -> Result<String> {
        let src_key = self.full_key(src_path);
        let dest_key = self.full_key(dest_path);
        let copy_source = format!("{}/{}", self.bucket, src_key);

        self.client
            .copy_object()
            .bucket(&self.bucket)
            .copy_source(&copy_source)
            .key(&dest_key)
            .send()
            .await
            .map_aster_err_ctx("S3 copy_object failed", AsterError::storage_driver_error)?;

        Ok(dest_path.to_string())
    }

    // ── S3 Multipart Upload ──────────────────────────────────────────

    async fn create_multipart_upload(&self, path: &str) -> Result<String> {
        let key = self.full_key(path);
        let resp = self
            .client
            .create_multipart_upload()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .map_aster_err_ctx(
                "S3 create_multipart_upload failed",
                AsterError::storage_driver_error,
            )?;

        resp.upload_id().map(|s| s.to_string()).ok_or_else(|| {
            AsterError::storage_driver_error("S3 multipart upload: missing upload_id")
        })
    }

    async fn presigned_upload_part_url(
        &self,
        path: &str,
        upload_id: &str,
        part_number: i32,
        expires: Duration,
    ) -> Result<String> {
        let key = self.full_key(path);
        let presign_config = PresigningConfig::builder()
            .expires_in(expires)
            .build()
            .map_aster_err_ctx("presign config", AsterError::storage_driver_error)?;

        let url = self
            .client
            .upload_part()
            .bucket(&self.bucket)
            .key(&key)
            .upload_id(upload_id)
            .part_number(part_number)
            .presigned(presign_config)
            .await
            .map_aster_err_ctx(
                "S3 presigned upload_part failed",
                AsterError::storage_driver_error,
            )?;

        Ok(url.uri().to_string())
    }

    async fn complete_multipart_upload(
        &self,
        path: &str,
        upload_id: &str,
        parts: Vec<(i32, String)>,
    ) -> Result<()> {
        use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};

        let completed_parts: Vec<CompletedPart> = parts
            .into_iter()
            .map(|(num, etag)| {
                CompletedPart::builder()
                    .part_number(num)
                    .e_tag(etag)
                    .build()
            })
            .collect();

        let key = self.full_key(path);
        self.client
            .complete_multipart_upload()
            .bucket(&self.bucket)
            .key(&key)
            .upload_id(upload_id)
            .multipart_upload(
                CompletedMultipartUpload::builder()
                    .set_parts(Some(completed_parts))
                    .build(),
            )
            .send()
            .await
            .map_aster_err_ctx(
                "S3 complete_multipart_upload failed",
                AsterError::storage_driver_error,
            )?;

        Ok(())
    }

    async fn abort_multipart_upload(&self, path: &str, upload_id: &str) -> Result<()> {
        let key = self.full_key(path);
        self.client
            .abort_multipart_upload()
            .bucket(&self.bucket)
            .key(&key)
            .upload_id(upload_id)
            .send()
            .await
            .map_aster_err_ctx(
                "S3 abort_multipart_upload failed",
                AsterError::storage_driver_error,
            )?;
        Ok(())
    }

    async fn list_uploaded_parts(&self, path: &str, upload_id: &str) -> Result<Vec<i32>> {
        let key = self.full_key(path);
        let mut part_numbers = Vec::new();
        let mut part_marker: Option<String> = None;

        loop {
            let mut req = self
                .client
                .list_parts()
                .bucket(&self.bucket)
                .key(&key)
                .upload_id(upload_id);
            if let Some(marker) = &part_marker {
                req = req.part_number_marker(marker.as_str());
            }

            let resp = req
                .send()
                .await
                .map_aster_err_ctx("S3 list_parts failed", AsterError::storage_driver_error)?;

            for part in resp.parts() {
                part_numbers.push(part.part_number.unwrap_or(0));
            }

            if resp.is_truncated() == Some(true) {
                part_marker = resp.next_part_number_marker().map(|s| s.to_string());
            } else {
                break;
            }
        }

        Ok(part_numbers)
    }
}
