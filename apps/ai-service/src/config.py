from pathlib import Path
from typing import Literal, Optional
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables and .env file.
    """
    model_config = SettingsConfigDict(
        # Resolve relative to this file so the service finds its .env regardless of the launch directory.
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    port: int = Field(default=8001, validation_alias="PORT")
    host: str = Field(default="127.0.0.1", validation_alias="HOST")
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="info", validation_alias="LOG_LEVEL")

    # Shared secret the Node API sends as `X-Internal-Token`. Leave empty only for local experiments.
    ai_service_token: Optional[str] = Field(default=None, validation_alias="AI_SERVICE_TOKEN")

    # No default on purpose: a missing DATABASE_URL should fail fast, not silently use a localhost guess.
    database_url: str = Field(validation_alias="DATABASE_URL")

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
    ai_provider: Literal["ollama", "mock", "gemini"] = Field(
        default="ollama",
        validation_alias="AI_PROVIDER"
    )

    gemini_api_key: Optional[str] = Field(
        default=None,
        validation_alias="GEMINI_API_KEY"
    )
    gemini_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        validation_alias="GEMINI_BASE_URL"
    )
    gemini_embedding_model: str = Field(
        default="gemini-embedding-001",
        validation_alias="GEMINI_EMBEDDING_MODEL"
    )
    gemini_primary_model: str = Field(
        default="gemini-3.6-flash",
        validation_alias=AliasChoices("GEMINI_PRIMARY_MODEL", "GEMINI_LLM_MODEL")
    )
    gemini_fallback_model: Optional[str] = Field(
        default="gemini-3-flash-preview",
        validation_alias=AliasChoices("GEMINI_FALLBACK_MODEL", "GEMINI_LLM_FALLBACK_MODEL")
    )
    gemini_max_retries: int = Field(
        default=4,
        validation_alias="GEMINI_MAX_RETRIES"
    )
    gemini_initial_retry_delay: float = Field(
        default=1.0,
        validation_alias="GEMINI_INITIAL_RETRY_DELAY"
    )
    gemini_max_retry_delay: float = Field(
        default=10.0,
        validation_alias="GEMINI_MAX_RETRY_DELAY"
    )
    gemini_timeout_seconds: float = Field(
        default=60.0,
        validation_alias="GEMINI_TIMEOUT_SECONDS"
    )

    @property
    def gemini_llm_model(self) -> str:
        return self.gemini_primary_model

    @property
    def gemini_llm_fallback_model(self) -> Optional[str]:
        return self.gemini_fallback_model

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


settings = Settings()  # type: ignore[call-arg]
