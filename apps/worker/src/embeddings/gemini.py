import logging
import random
import time
from typing import List, Optional

import httpx

from src.config import settings
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

    def _calculate_retry_delay(self, attempt: int, resp: Optional[httpx.Response] = None) -> float:
        initial_delay = getattr(settings, "GEMINI_INITIAL_RETRY_DELAY", 1.0)
        max_delay = getattr(settings, "GEMINI_MAX_RETRY_DELAY", 10.0)
        if resp is not None:
            header = resp.headers.get("retry-after")
            if header:
                try:
                    parsed = float(header)
                    return min(parsed, max_delay) + random.uniform(0.0, 0.5)
                except ValueError:
                    pass
        base = min(initial_delay * (2 ** (attempt - 1)), max_delay)
        return min(base + random.uniform(0.0, 0.5), max_delay + 0.5)

    def _post(self, endpoint: str, payload: dict) -> httpx.Response:
        """POST with exponential backoff (honoring Retry-After) for 429/5xx and transport errors."""
        last_status = "unknown"
        for attempt in range(1, self.max_retries + 1):
            resp: Optional[httpx.Response] = None
            try:
                resp = self._client.post(endpoint, json=payload)
            except httpx.TransportError as e:
                last_status = type(e).__name__
                if attempt == self.max_retries:
                    logger.error(
                        f"Gemini request failed permanently: status={last_status}, model={self.model_name}, attempts={attempt}/{self.max_retries}. All retries exhausted."
                    )
                    break
                wait_seconds = self._calculate_retry_delay(attempt, None)
                logger.warning(
                    f"Gemini request failed: status={last_status}, model={self.model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                )
                time.sleep(wait_seconds)
                continue

            status = resp.status_code
            last_status = str(status)

            if status == 200:
                return resp

            if status in (401, 403):
                logger.error(
                    f"Gemini request rejected permanently: status={status}, model={self.model_name}, error=The Gemini API key was rejected."
                )
                raise RuntimeError("The Gemini API key was rejected (check GEMINI_API_KEY and permissions).")

            if status in (400, 404, 422):
                logger.warning(
                    f"Gemini request rejected permanently: status={status}, model={self.model_name}, error=HTTP {status}"
                )
                raise RuntimeError(f"Gemini rejected the embedding request: HTTP {status}: {resp.text[:200]}")

            is_rate_limit = (status == 429)
            if attempt == self.max_retries:
                logger.error(
                    f"Gemini request failed permanently: status={status}, model={self.model_name}, attempts={attempt}/{self.max_retries}. All retries exhausted."
                )
                break

            wait_seconds = self._calculate_retry_delay(attempt, resp)
            if is_rate_limit:
                logger.warning(
                    f"Gemini request rate limited (quota/rate limit): status=429, model={self.model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                )
            else:
                logger.warning(
                    f"Gemini request failed: status={status}, model={self.model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                )
            time.sleep(wait_seconds)

        raise RuntimeError(
            f"Gemini embedding request failed after {self.max_retries} attempts: {last_status}"
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
