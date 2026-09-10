import asyncio
import json
import math
from typing import AsyncIterator, Optional
import httpx
import numpy as np
from src.config import settings
from src.logger import logger
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider


class OllamaProvider(BaseEmbeddingProvider, BaseLLMProvider):
    """
    Asynchronous client for interacting with a local or remote Ollama instance.
    Handles embeddings, completions, streaming, and connection retries.
    """
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.embedding_model = settings.embedding_model
        self.llm_model = settings.llm_model
        self.dimension = settings.embedding_dimension
        self.timeout = httpx.Timeout(settings.ollama_timeout_seconds, connect=10.0)

    def _sanitize_text(self, text: str) -> str:
        """
        Strips null bytes and caps text at a defensive limit (8,000 characters).
        """
        if not text:
            return ""
        clean = text.replace("\x00", "").strip()
        return clean[:8000]

    def _l2_normalize(self, vec: list[float]) -> list[float]:
        """
        Normalizes vector to unit length (Euclidean L2 norm) for cosine similarity.
        """
        arr = np.array(vec, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 1e-12:
            arr = arr / norm
        return arr.tolist()

    async def _post_with_retry(
        self, endpoint: str, json_payload: dict, retries: int = 3
    ) -> httpx.Response:
        """
        Executes an HTTP POST with exponential backoff for transient failures.
        """
        url = f"{self.base_url}{endpoint}"
        last_err: Optional[Exception] = None

        for attempt in range(1, retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(url, json=json_payload)
                    resp.raise_for_status()
                    return resp
            except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
                last_err = exc
                if attempt == retries:
                    break
                wait_seconds = math.pow(2, attempt - 1) * 0.5
                logger.warning(
                    f"Ollama request to {endpoint} failed (attempt {attempt}/{retries}): {exc}. Retrying in {wait_seconds:.1f}s..."
                )
                await asyncio.sleep(wait_seconds)

        raise RuntimeError(f"Ollama request to {endpoint} failed after {retries} attempts: {last_err}")

    async def embed_text(self, text: str) -> list[float]:
        """
        Generates a 768-dim normalized embedding for a single string.
        """
        clean_text = self._sanitize_text(text)
        if not clean_text:
            return [0.0] * self.dimension

        # Try batch /api/embed first
        try:
            resp = await self._post_with_retry(
                "/api/embed",
                {"model": self.embedding_model, "input": [clean_text]},
            )
            data = resp.json()
            if "embeddings" in data and len(data["embeddings"]) > 0:
                raw_vec = data["embeddings"][0]
                return self._l2_normalize(raw_vec)
        except Exception as embed_err:
            logger.debug(f"/api/embed failed, attempting /api/embeddings fallback: {embed_err}")

        # Fallback to legacy /api/embeddings
        resp = await self._post_with_retry(
            "/api/embeddings",
            {"model": self.embedding_model, "prompt": clean_text},
        )
        data = resp.json()
        if "embedding" in data:
            return self._l2_normalize(data["embedding"])

        raise ValueError("Invalid response from Ollama embedding API: no vector returned.")

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generates embeddings for multiple texts.
        """
        if not texts:
            return []

        clean_texts = [self._sanitize_text(t) for t in texts]

        try:
            resp = await self._post_with_retry(
                "/api/embed",
                {"model": self.embedding_model, "input": clean_texts},
            )
            data = resp.json()
            if "embeddings" in data and len(data["embeddings"]) == len(texts):
                return [self._l2_normalize(vec) for vec in data["embeddings"]]
        except Exception as exc:
            logger.debug(f"Batch embed failed, falling back to sequential: {exc}")

        # Sequential fallback if batch not supported
        results: list[list[float]] = []
        for t in clean_texts:
            results.append(await self.embed_text(t))
        return results

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> str:
        """
        Generates a complete answer synchronously using Ollama /api/chat.
        """
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if history:
            for item in history[-4:]:  # last 2 turns
                messages.append({"role": item["role"].lower(), "content": item["content"]})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.llm_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2},
        }

        resp = await self._post_with_retry("/api/chat", payload)
        data = resp.json()
        message = data.get("message", {})
        return message.get("content", "").strip()

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        """
        Yields response tokens asynchronously via Ollama /api/chat stream.
        """
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if history:
            for item in history[-4:]:
                messages.append({"role": item["role"].lower(), "content": item["content"]})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.llm_model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": 0.2},
        }

        url = f"{self.base_url}/api/chat"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk_json = json.loads(line)
                        content = chunk_json.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue
