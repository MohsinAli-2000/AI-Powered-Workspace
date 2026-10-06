import logging
import random
import time
from typing import List

import httpx

from src.embeddings.base import BaseEmbeddingClient

logger = logging.getLogger(__name__)


class GeminiEmbeddingClient(BaseEmbeddingClient):
    """
    Gemini API embedding client (batchEmbedContents) with exponential backoff retries.
    Requests `expected_dimension`-dim vectors so the pgvector schema is unchanged.
    Must use the same model as apps/ai-service so query and document vectors match.
    """

    MAX_BATCH = 100

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        model_name: str = "gemini-embedding-001",
        expected_dimension: int = 768,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ):
        super().__init__(model_name=model_name, expected_dimension=expected_dimension)
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set but EMBEDDING_PROVIDER=gemini")
        self.max_retries = max_retries
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            timeout=httpx.Timeout(timeout_seconds, connect=10.0),
        )
        logger.info(
            f"Initialized GeminiEmbeddingClient: model={self.model_name}, dim={self.expected_dimension}"
        )

    def close(self):
        self._client.close()

    def health_check(self) -> bool:
        try:
            return self._client.get(f"/models/{self.model_name}").status_code == 200
        except Exception as e:
            logger.debug(f"Gemini health check failed: {e}")
            return False

    def _post(self, endpoint: str, payload: dict) -> httpx.Response:
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self._client.post(endpoint, json=payload)
                if resp.status_code == 200:
                    return resp
                if resp.status_code in (429, 500, 502, 503, 504):
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    logger.warning(f"Gemini {last_error} (attempt {attempt}/{self.max_retries})")
                else:
                    resp.raise_for_status()
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = str(e)
                logger.warning(f"Gemini connection error (attempt {attempt}/{self.max_retries}): {e}")
            if attempt < self.max_retries:
                time.sleep((2 ** (attempt - 1)) * 1.0 + random.uniform(0.1, 0.4))
        raise RuntimeError(
            f"Gemini embedding request failed after {self.max_retries} attempts: {last_error}"
        )

    def embed_text(self, text: str) -> List[float]:
        vectors = self.embed_batch([text])
        if not vectors:
            raise ValueError("No embedding vector returned by Gemini.")
        return vectors[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        cleaned = [self.sanitize_text(t) or " " for t in texts]
        results: List[List[float]] = []
        for i in range(0, len(cleaned), self.MAX_BATCH):
            group = cleaned[i:i + self.MAX_BATCH]
            payload = {
                "requests": [
                    {
                        "model": f"models/{self.model_name}",
                        "content": {"parts": [{"text": t}]},
                        "outputDimensionality": self.expected_dimension,
                    }
                    for t in group
                ]
            }
            resp = self._post(f"/models/{self.model_name}:batchEmbedContents", payload)
            embeddings = resp.json().get("embeddings", [])
            if len(embeddings) != len(group):
                raise ValueError(
                    f"Gemini returned {len(embeddings)} vectors, expected {len(group)}"
                )
            for emb in embeddings:
                vec = emb["values"]
                self.validate_dimension(vec)
                results.append(self.normalize_l2(vec))
        return results
