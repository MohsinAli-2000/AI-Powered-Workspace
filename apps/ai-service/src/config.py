from typing import Literal, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables and .env file.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    port: int = Field(default=8001, validation_alias="PORT")
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="info", validation_alias="LOG_LEVEL")

    database_url: str = Field(
        default="postgresql://postgres:postgresadmin@localhost:5432/ai_workspace",
        validation_alias="DATABASE_URL"
    )

    ollama_base_url: str = Field(
        default="http://localhost:11434",
        validation_alias="OLLAMA_BASE_URL"
    )
    embedding_model: str = Field(
        default="nomic-embed-text",
        validation_alias="EMBEDDING_MODEL"
    )
    embedding_dimension: int = Field(
        default=768,
        validation_alias="EMBEDDING_DIMENSION"
    )
    llm_model: str = Field(
        default="qwen2.5",
        validation_alias="LLM_MODEL"
    )
    ai_provider: Literal["ollama", "mock"] = Field(
        default="ollama",
        validation_alias="AI_PROVIDER"
    )

    rag_similarity_threshold: float = Field(
        default=0.35,
        validation_alias="RAG_SIMILARITY_THRESHOLD"
    )
    rag_top_k: int = Field(
        default=5,
        validation_alias="RAG_TOP_K"
    )

    sentry_dsn: Optional[str] = Field(
        default=None,
        validation_alias="SENTRY_DSN"
    )

    ollama_timeout_seconds: float = Field(
        default=60.0,
        validation_alias="OLLAMA_TIMEOUT_SECONDS"
    )
    ollama_max_retries: int = Field(
        default=3,
        validation_alias="OLLAMA_MAX_RETRIES"
    )


settings = Settings()
