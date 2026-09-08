from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices

WORKER_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(WORKER_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")
    DB_POOL_MIN: int = Field(default=2, description="Minimum pool connections")
    DB_POOL_MAX: int = Field(default=10, description="Maximum pool connections")

    # Logging
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")

    # S3 / MinIO Storage
    S3_ENDPOINT: str = Field(
        default="http://localhost:9000",
        validation_alias=AliasChoices("S3_ENDPOINT", "S3_ENDPOINT_URL"),
        description="S3 / MinIO endpoint URL"
    )
    S3_ACCESS_KEY_ID: str = Field(..., description="S3 Access Key ID")
    S3_SECRET_ACCESS_KEY: str = Field(..., description="S3 Secret Access Key")
    S3_REGION: str = Field(default="us-east-1")
    S3_BUCKET_NAME: str = Field(default="ai-workspace-documents")
    S3_FORCE_PATH_STYLE: bool = Field(default=True, description="Force path style addressing")
    MAX_FILE_SIZE_BYTES: int = Field(
        default=52_428_800,  # 50MB (FR-DOC-003)
        description="Maximum allowed file size in bytes"
    )

    # RabbitMQ
    RABBITMQ_URL: str = Field(..., description="RabbitMQ AMQP connection URL")
    QUEUE_NAME: str = Field(default="document-processing")

    # Chunking defaults
    CHUNK_SIZE: int = Field(default=1000)  # characters
    CHUNK_OVERLAP: int = Field(default=200)  # characters

    @property
    def S3_ENDPOINT_URL(self) -> str:
        """Backward-compatible property for S3 endpoint URL."""
        return self.S3_ENDPOINT


settings = Settings()


