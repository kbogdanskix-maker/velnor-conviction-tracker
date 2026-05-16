"""
Cloudflare R2 storage — broker import file uploads.
R2 is S3-compatible so we use boto3.
"""
import logging
import boto3
from botocore.exceptions import ClientError
from app.config import settings

logger = logging.getLogger(__name__)

_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _s3_client


async def upload_to_r2(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """
    Upload bytes to R2. Returns the object key (used as the file_url in DB).
    R2 objects are private — we generate presigned URLs for access.
    """
    import asyncio

    def _sync_upload():
        s3 = _get_s3()
        s3.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    return await asyncio.to_thread(_sync_upload)


async def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for temporary access to a private R2 object."""
    import asyncio

    def _sync_presign():
        s3 = _get_s3()
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )

    return await asyncio.to_thread(_sync_presign)


async def download_from_r2(key: str) -> bytes:
    """Download an object from R2 as bytes."""
    import asyncio

    def _sync_download():
        s3 = _get_s3()
        response = s3.get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return response["Body"].read()

    return await asyncio.to_thread(_sync_download)
