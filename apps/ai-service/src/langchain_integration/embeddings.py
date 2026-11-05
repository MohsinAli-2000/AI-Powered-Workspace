import asyncio
from typing import Optional
from langchain_core.embeddings import Embeddings
from src.providers import get_embedding_provider
from src.providers.base import BaseEmbeddingProvider


class ProviderEmbeddings(Embeddings):
    """
    LangChain `Embeddings` backed by the configured service provider (Gemini / mock / Ollama).

    Delegates 1:1 to `embed_text` / `embed_batch`, so sanitization, L2 normalization, dimension
    checks and retry behaviour are exactly those of the provider.
    """

    def __init__(self, provider: Optional[BaseEmbeddingProvider] = None) -> None:
        # Resolved lazily so the provider singleton (and its config validation) is reused.
        self._provider = provider

    @property
    def provider(self) -> BaseEmbeddingProvider:
        return self._provider if self._provider is not None else get_embedding_provider()

    async def aembed_query(self, text: str) -> list[float]:
        return await self.provider.embed_text(text)

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self.provider.embed_batch(texts)

    # The service is fully async; sync variants exist for LangChain tooling used outside an event loop.
    def embed_query(self, text: str) -> list[float]:
        return asyncio.run(self.aembed_query(text))

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return asyncio.run(self.aembed_documents(texts))
