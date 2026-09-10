import logging
from typing import Optional

from src.config import settings
from src.embeddings.base import BaseEmbeddingClient
from src.embeddings.mock import MockEmbeddingClient
from src.embeddings.ollama import OllamaEmbeddingClient

logger = logging.getLogger(__name__)

_embedding_client_instance: Optional[BaseEmbeddingClient] = None


def get_embedding_client(
    provider: Optional[str] = None,
    force_new: bool = False
) -> BaseEmbeddingClient:
    """
    Factory function returning the configured singleton embedding client.
    Supported providers: 'ollama', 'mock'
    """
    global _embedding_client_instance

    chosen_provider = (provider or settings.EMBEDDING_PROVIDER).lower().strip()

    if _embedding_client_instance is not None and not force_new:
        if chosen_provider == "ollama" and isinstance(_embedding_client_instance, OllamaEmbeddingClient):
            return _embedding_client_instance
        if chosen_provider in ("mock", "test") and isinstance(_embedding_client_instance, MockEmbeddingClient):
            return _embedding_client_instance

    if chosen_provider == "ollama":
        client = OllamaEmbeddingClient(
            base_url=settings.OLLAMA_BASE_URL,
            model_name=settings.EMBEDDING_MODEL,
            expected_dimension=settings.EMBEDDING_DIMENSION,
            timeout_seconds=settings.EMBEDDING_TIMEOUT_SECONDS,
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    elif chosen_provider in ("mock", "test"):
        client = MockEmbeddingClient(
            model_name=settings.EMBEDDING_MODEL,
            expected_dimension=settings.EMBEDDING_DIMENSION,
        )
    else:
        logger.warning(
            f"Unrecognized EMBEDDING_PROVIDER '{chosen_provider}'. Falling back to MockEmbeddingClient."
        )
        client = MockEmbeddingClient(
            model_name=settings.EMBEDDING_MODEL,
            expected_dimension=settings.EMBEDDING_DIMENSION,
        )

    if not force_new and provider is None:
        _embedding_client_instance = client

    return client


__all__ = [
    "BaseEmbeddingClient",
    "OllamaEmbeddingClient",
    "MockEmbeddingClient",
    "get_embedding_client",
]
