from src.config import settings
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider
# from src.providers.ollama import OllamaProvider  # Kept for reference (uncomment to use local Ollama models)
from src.providers.gemini import GeminiProvider
from src.providers.mock import MockProvider

# _ollama_instance: OllamaProvider | None = None  # Kept for reference
_mock_instance: MockProvider | None = None
_gemini_instance: GeminiProvider | None = None


def _get_provider() -> MockProvider | GeminiProvider:
    global _mock_instance, _gemini_instance
    if settings.ai_provider == "mock":
        if _mock_instance is None:
            _mock_instance = MockProvider()
        return _mock_instance
    if settings.ai_provider == "gemini":
        if _gemini_instance is None:
            _gemini_instance = GeminiProvider()
        return _gemini_instance

    # -------------------------------------------------------------------------
    # LOCAL OLLAMA PROVIDER (Commented out for reference):
    # To use local models:
    # 1. Uncomment the import at the top of this file and the block below:
    # -------------------------------------------------------------------------
    # if settings.ai_provider == "ollama":
    #     global _ollama_instance
    #     if _ollama_instance is None:
    #         from src.providers.ollama import OllamaProvider
    #         _ollama_instance = OllamaProvider()
    #     return _ollama_instance

    # Default to Gemini if Ollama is selected while commented out or fallback
    if _gemini_instance is None:
        _gemini_instance = GeminiProvider()
    return _gemini_instance


def get_embedding_provider() -> BaseEmbeddingProvider:
    return _get_provider()


def get_llm_provider() -> BaseLLMProvider:
    return _get_provider()
