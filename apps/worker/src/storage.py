import io
import logging
from typing import BinaryIO
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from src.config import settings

logger = logging.getLogger(__name__)


class StorageClient:
    def __init__(self):
        # Configure s3 client supporting path-style addressing for MinIO / LocalStack
        s3_config = Config(s3={"addressing_style": "path"}) if settings.S3_FORCE_PATH_STYLE else Config()
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT if settings.S3_ENDPOINT else None,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            region_name=settings.S3_REGION,
            config=s3_config
        )
        self.bucket = settings.S3_BUCKET_NAME

    def download_file(self, storage_key: str) -> io.BytesIO:
        """
        Download a file from S3 / MinIO into a BytesIO stream.
        Pre-validates object existence and enforces MAX_FILE_SIZE_BYTES limit to prevent OOM.
        Raises FileNotFoundError or ValueError if invalid.
        """
        try:
            # 1. Pre-flight check file metadata & size (defense-in-depth against OOM)
            head = self.s3.head_object(Bucket=self.bucket, Key=storage_key)
            content_length = head.get("ContentLength", 0)

            if content_length > settings.MAX_FILE_SIZE_BYTES:
                error_msg = (
                    f"File {storage_key} size ({content_length} bytes) exceeds "
                    f"configured limit of {settings.MAX_FILE_SIZE_BYTES} bytes."
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            logger.info(
                f"Downloading {storage_key} ({content_length} bytes) from bucket '{self.bucket}'..."
            )
            buffer = io.BytesIO()
            self.s3.download_fileobj(self.bucket, storage_key, buffer)
            buffer.seek(0)
            return buffer

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                logger.error(f"Object not found in storage: {storage_key}")
                raise FileNotFoundError(f"Key '{storage_key}' not found in bucket '{self.bucket}'")
            logger.error(f"Failed to download object {storage_key}: {e}")
            raise


storage_client = StorageClient()

