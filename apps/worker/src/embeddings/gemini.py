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
        """POST with exponential backoff (honoring Retry-After) for 429/5xx and transport errors."""
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            retry_after = None
            try:
                resp = self._client.post(endpoint, json=payload)
                if resp.status_code == 200:
                    return resp
                if resp.status_code in (429, 500, 502, 503, 504):
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    header = resp.headers.get("retry-after")
                    if header:
                        try:
                            retry_after = min(float(header), 60.0)
                        except ValueError:
                            retry_after = None
                    logger.warning(f"Gemini {last_error} (attempt {attempt}/{self.max_retries})")
                else:
                    # 4xx other than 429: retrying cannot help (bad key, bad request...)
                    raise RuntimeError(f"Gemini rejected the embedding request: HTTP {resp.status_code}: {resp.text[:200]}")
            except httpx.TransportError as e:  # timeouts, resets, DNS, protocol errors
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(f"Gemini connection error (attempt {attempt}/{self.max_retries}): {e}")
            if attempt < self.max_retries:
                delay = retry_after if retry_after is not None else min(2 ** attempt, 30) + random.uniform(0.1, 0.9)
                time.sleep(delay)
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
            try:
                embeddings = resp.json().get("embeddings", [])
            except ValueError as exc:
                raise RuntimeError(f"Gemini returned an unreadable response: {exc}")
            if len(embeddings) != len(group):
                raise ValueError(
                    f"Gemini returned {len(embeddings)} vectors, expected {len(group)}"
                )
            for emb in embeddings:
                vec = emb.get("values")
                if not vec:
                    raise ValueError("Gemini returned an empty embedding vector.")
                self.validate_dimension(vec)
                results.append(self.normalize_l2(vec))
        return results
