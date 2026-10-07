import logging
from typing import Optional

from src.config import settings
from src.embeddings.base import BaseEmbeddingClient
from src.embeddings.mock import MockEmbeddingClient
# from src.embeddings.ollama import OllamaEmbeddingClient  # Kept for reference (uncomment to use local Ollama)
from src.embeddings.gemini import GeminiEmbeddingClient

logger = logging.getLogger(__name__)

_embedding_client_instance: Optional[BaseEmbeddingClient] = None


def get_embedding_client(
    provider: Optional[str] = None,
    force_new: bool = False
) -> BaseEmbeddingClient:
    """
    Factory function returning the configured singleton embedding client.
    Supported providers: 'gemini', 'mock' (and 'ollama' when uncommented).
    """
    global _embedding_client_instance

    chosen_provider = (provider or settings.EMBEDDING_PROVIDER).lower().strip()

    if _embedding_client_instance is not None and not force_new:
        # Local Ollama client singleton check (commented out for reference):
        # if chosen_provider == "ollama":
        #     return _embedding_client_instance
        if chosen_provider == "gemini" and isinstance(_embedding_client_instance, GeminiEmbeddingClient):
            return _embedding_client_instance
        if chosen_provider in ("mock", "test") and isinstance(_embedding_client_instance, MockEmbeddingClient):
            return _embedding_client_instance

    if chosen_provider == "gemini":
        # No silent mock fallback: bad vectors would corrupt retrieval.
        client = GeminiEmbeddingClient(
            api_key=settings.GEMINI_API_KEY,
            base_url=settings.GEMINI_BASE_URL,
            model_name=settings.GEMINI_EMBEDDING_MODEL,
            expected_dimension=settings.EMBEDDING_DIMENSION,
            timeout_seconds=settings.EMBEDDING_TIMEOUT_SECONDS,
            max_retries=settings.EMBEDDING_MAX_RETRIES,
        )
    # -------------------------------------------------------------------------
    # LOCAL OLLAMA EMBEDDING CLIENT (Commented out for reference):
    # To use local models:
    # 1. Uncomment the OllamaEmbeddingClient import at the top of this file.
    # 2. Uncomment the block below:
    # -------------------------------------------------------------------------
    # elif chosen_provider == "ollama":
    #     from src.embeddings.ollama import OllamaEmbeddingClient
    #     ollama_client = OllamaEmbeddingClient(
    #         base_url=settings.OLLAMA_BASE_URL,
    #         model_name=settings.EMBEDDING_MODEL,
    #         expected_dimension=settings.EMBEDDING_DIMENSION,
    #         timeout_seconds=settings.EMBEDDING_TIMEOUT_SECONDS,
    #         max_retries=settings.EMBEDDING_MAX_RETRIES,
    #     )
    #     if not ollama_client.health_check():
    #         raise RuntimeError(
    #             f"Ollama daemon unreachable at {settings.OLLAMA_BASE_URL}. "
    #             "Start Ollama, or set EMBEDDING_PROVIDER=gemini (or mock, explicitly, for tests)."
    #         )
    #     client = ollama_client
    elif chosen_provider in ("mock", "test"):
        client = MockEmbeddingClient(
            model_name=settings.EMBEDDING_MODEL,
            expected_dimension=settings.EMBEDDING_DIMENSION,
        )
    else:
        raise ValueError(
            f"Unrecognized EMBEDDING_PROVIDER '{chosen_provider}'. Use 'gemini' or 'mock' (Ollama is currently commented out)."
        )

    if not force_new and provider is None:
        _embedding_client_instance = client

    return client


__all__ = [
    "BaseEmbeddingClient",
    # "OllamaEmbeddingClient",  # Uncomment when using local Ollama
    "GeminiEmbeddingClient",
    "MockEmbeddingClient",
    "get_embedding_client",
]
