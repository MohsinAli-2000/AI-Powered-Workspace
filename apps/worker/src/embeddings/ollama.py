import logging
import random
import time
from typing import Any, Dict, List, Optional
import httpx

from src.embeddings.base import BaseEmbeddingClient

logger = logging.getLogger(__name__)


class OllamaEmbeddingClient(BaseEmbeddingClient):
    """
    Ollama embedding client with batch support, exponential backoff retries,
    fallback between /api/embed and /api/embeddings, and vector validation.
    """

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model_name: str = "nomic-embed-text",
        expected_dimension: int = 768,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
    ):
        super().__init__(model_name=model_name, expected_dimension=expected_dimension)
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self._supports_batch_endpoint: Optional[bool] = None

        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout_seconds, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        logger.info(
            f"Initialized OllamaEmbeddingClient: url={self.base_url}, "
            f"model={self.model_name}, dim={self.expected_dimension}"
        )

    def close(self):
        """Close the underlying HTTP client."""
        if self._client:
            self._client.close()

    def health_check(self) -> bool:
        """Check if Ollama server is reachable and responsive."""
        try:
            resp = self._client.get("/api/version")
            return resp.status_code == 200
        except Exception as e:
            logger.debug(f"Ollama health check failed: {e}")
            return False

    def _execute_with_retry(self, request_fn) -> httpx.Response:
        """Executes an HTTP request with exponential backoff and jitter."""
        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                resp = request_fn()
                if resp.status_code == 200:
                    return resp
                if resp.status_code == 404 and "/api/embed" in str(resp.request.url):
                    # Batch endpoint not supported on older Ollama versions, signal fallback
                    return resp
                if resp.status_code in (429, 500, 502, 503, 504):
                    logger.warning(
                        f"Ollama returned HTTP {resp.status_code} (attempt {attempt}/{self.max_retries}). Retrying..."
                    )
                else:
                    resp.raise_for_status()
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as e:
                last_error = e
                logger.warning(
                    f"Ollama connection error (attempt {attempt}/{self.max_retries}): {e}"
                )

            if attempt < self.max_retries:
                # Exponential backoff: 0.5s, 1.0s, 2.0s with random jitter
                backoff = (2 ** (attempt - 1)) * 0.5 + random.uniform(0.1, 0.4)
                time.sleep(backoff)

        raise RuntimeError(
            f"Ollama embedding request failed after {self.max_retries} attempts: {last_error}"
        )

    def embed_text(self, text: str) -> List[float]:
        """Embed a single text string."""
        vectors = self.embed_batch([text])
        if not vectors:
            raise ValueError("No embedding vector returned by Ollama.")
        return vectors[0]

    def _embed_batch_via_embed_api(self, cleaned_texts: List[str]) -> Optional[List[List[float]]]:
        """Attempt to use modern Ollama /api/embed batch endpoint."""
        payload = {
            "model": self.model_name,
            "input": cleaned_texts,
        }
        resp = self._execute_with_retry(lambda: self._client.post("/api/embed", json=payload))
        if resp.status_code == 404:
            self._supports_batch_endpoint = False
            return None

        resp.raise_for_status()
        data = resp.json()
        raw_embeddings = data.get("embeddings", [])
        if not raw_embeddings or len(raw_embeddings) != len(cleaned_texts):
            raise ValueError(
                f"Ollama /api/embed returned {len(raw_embeddings)} vectors, expected {len(cleaned_texts)}"
            )

        processed = []
        for vec in raw_embeddings:
            self.validate_dimension(vec)
            processed.append(self.normalize_l2(vec))
        return processed

    def _embed_batch_via_embeddings_api(self, cleaned_texts: List[str]) -> List[List[float]]:
        """Fallback to single-item /api/embeddings endpoint."""
        results = []
        for text in cleaned_texts:
            payload = {
                "model": self.model_name,
                "prompt": text,
            }
            resp = self._execute_with_retry(lambda: self._client.post("/api/embeddings", json=payload))
            resp.raise_for_status()
            data = resp.json()
            vec = data.get("embedding", [])
            if not vec:
                raise ValueError(f"Ollama returned empty vector for prompt: {text[:50]}...")
            self.validate_dimension(vec)
            results.append(self.normalize_l2(vec))
        return results

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embeds a batch of texts using the best available endpoint."""
        if not texts:
            return []

        cleaned_texts = [self.sanitize_text(t) for t in texts]

        # Check if batch endpoint is supported or unknown
        if self._supports_batch_endpoint is not False:
            try:
                embeddings = self._embed_batch_via_embed_api(cleaned_texts)
                if embeddings is not None:
                    self._supports_batch_endpoint = True
                    return embeddings
            except Exception as e:
                logger.warning(f"Batch /api/embed failed, attempting fallback: {e}")

        # Fallback to single-prompt /api/embeddings
        return self._embed_batch_via_embeddings_api(cleaned_texts)
