import asyncio
import hashlib
import random
from typing import AsyncIterator, Optional
import numpy as np
from src.config import settings
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider


class MockProvider(BaseEmbeddingProvider, BaseLLMProvider):
    """
    Deterministic AI provider producing reproducible 768-dim L2-normalized embeddings
    and grounded answers for test suites and offline environments.
    """
    def __init__(self) -> None:
        self.dimension = settings.embedding_dimension

    def _generate_vector(self, text: str) -> list[float]:
        # Hash text to derive a deterministic pseudo-random seed
        h = hashlib.sha256(text.encode("utf-8")).digest()
        seed = int.from_bytes(h[:8], byteorder="big")
        rng = random.Random(seed)

        raw = [rng.gauss(0.0, 1.0) for _ in range(self.dimension)]
        arr = np.array(raw, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 1e-12:
            arr = arr / norm
        return arr.tolist()

    async def embed_text(self, text: str) -> list[float]:
        return self._generate_vector(text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self._generate_vector(t) for t in texts]

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> str:
        # If context tags exist in prompt, construct grounded response
        if "<context_document" in prompt:
            return (
                "Based on the provided organization documents, here is the answer: "
                "The documented roadmap highlights key Q4 deliverables and architectural requirements."
            )
        return "This is a simulated assistant response from the Mock AI Service provider."

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        full_text = await self.generate(prompt, system_prompt, history)
        tokens = full_text.split(" ")
        for i, token in enumerate(tokens):
            yield token + (" " if i < len(tokens) - 1 else "")
            await asyncio.sleep(0.01)  # small async pause
