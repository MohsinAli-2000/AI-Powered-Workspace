import hashlib
import logging
import math
from typing import List

from src.embeddings.base import BaseEmbeddingClient

logger = logging.getLogger(__name__)


class MockEmbeddingClient(BaseEmbeddingClient):
    """
    Deterministic mock embedding client for testing and offline development.
    Generates reproducible unit-normalized vectors based on SHA-256 seed of text content.
    """

    def __init__(self, model_name: str = "mock-embed", expected_dimension: int = 768):
        super().__init__(model_name=model_name, expected_dimension=expected_dimension)
        logger.info(
            f"Initialized MockEmbeddingClient (model={self.model_name}, dimension={self.expected_dimension})"
        )

    def health_check(self) -> bool:
        return True

    def _generate_vector(self, text: str) -> List[float]:
        cleaned = self.sanitize_text(text)
        if not cleaned:
            # Deterministic zero vector or tiny epsilon
            return [0.0] * self.expected_dimension

        # Generate seed from SHA-256
        h = hashlib.sha256(cleaned.encode("utf-8")).digest()

        # Generate pseudo-random float components using repeating digest values
        vector = []
        for i in range(self.expected_dimension):
            byte_idx = (i * 4) % len(h)
            chunk_int = int.from_bytes(h[byte_idx:byte_idx + 2], byteorder="big", signed=True)
            # Map to [-1.0, 1.0] with positional variance
            val = math.sin(chunk_int + i)
            vector.append(val)

        # L2 normalize
        normalized = self.normalize_l2(vector)
        self.validate_dimension(normalized)
        return normalized

    def embed_text(self, text: str) -> List[float]:
        return self._generate_vector(text)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]
