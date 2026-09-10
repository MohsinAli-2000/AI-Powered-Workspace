import logging
import math
from abc import ABC, abstractmethod
from typing import List, Optional

logger = logging.getLogger(__name__)


class BaseEmbeddingClient(ABC):
    """Abstract base class for all embedding provider implementations."""

    def __init__(self, model_name: str, expected_dimension: int):
        self.model_name = model_name
        self.expected_dimension = expected_dimension

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generate a vector embedding for a single text chunk."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a batch of text chunks."""
        pass

    @abstractmethod
    def health_check(self) -> bool:
        """Verify provider availability."""
        pass

    def validate_dimension(self, vector: List[float]) -> None:
        """Ensure the produced vector matches the expected database dimension."""
        actual_dim = len(vector)
        if actual_dim != self.expected_dimension:
            raise ValueError(
                f"Embedding dimension mismatch: Model '{self.model_name}' produced {actual_dim} dimensions, "
                f"but {self.expected_dimension} was expected. Check model configuration or database schema."
            )

    @staticmethod
    def normalize_l2(vector: List[float]) -> List[float]:
        """Normalize a vector to unit length (L2 norm) for cosine similarity."""
        norm = math.sqrt(sum(x * x for x in vector))
        if norm == 0.0 or math.isnan(norm):
            return vector
        return [x / norm for x in vector]

    @staticmethod
    def sanitize_text(text: Optional[str], max_chars: int = 8000) -> str:
        """Sanitizes text and applies a defensive character cap to prevent token overflow."""
        if not text:
            return ""
        # Remove null bytes
        cleaned = text.replace("\x00", "").strip()
        # Defensive length cap
        if len(cleaned) > max_chars:
            logger.warning(f"Chunk text truncated from {len(cleaned)} to {max_chars} characters for embedding.")
            cleaned = cleaned[:max_chars]
        return cleaned
