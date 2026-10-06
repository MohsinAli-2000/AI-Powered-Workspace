import asyncio
import json
import random
import time
from typing import AsyncIterator, Optional
import httpx
import numpy as np
from src.config import settings
from src.errors import InvalidInputError, ProviderRequestError, ProviderUnavailableError
from src.logger import logger
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider


class GeminiProvider(BaseEmbeddingProvider, BaseLLMProvider):
    """
    Asynchronous client for the Google Gemini API (embeddings + generation).
    Embeddings are requested with the same dimensionality as the configured
    vector column (default 768) so the database schema stays unchanged.
    """
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set but AI_PROVIDER=gemini")
        self.base_url = settings.gemini_base_url.rstrip("/")
        self.api_key = settings.gemini_api_key
        self.embedding_model = settings.gemini_embedding_model
        self.llm_model = settings.gemini_llm_model
        self.dimension = settings.embedding_dimension
        self.timeout = httpx.Timeout(settings.ollama_timeout_seconds, connect=10.0)

    @property
    def _headers(self) -> dict[str, str]:
        return {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

    def _sanitize_text(self, text: str) -> str:
        if not text:
            return ""
        return text.replace("\x00", "").strip()[:8000]

    def _l2_normalize(self, vec: list[float]) -> list[float]:
        arr = np.array(vec, dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 1e-12:
            arr = arr / norm
        return arr.tolist()

    @staticmethod
    def _error_message(resp: httpx.Response) -> str:
        """Short, safe description of a Gemini error response (no URLs, no keys)."""
        try:
            return str(resp.json().get("error", {}).get("message", ""))[:200] or f"HTTP {resp.status_code}"
        except ValueError:
            return f"HTTP {resp.status_code}"

    @staticmethod
    def _retry_delay(attempt: int, resp: Optional[httpx.Response]) -> float:
        """Honor Retry-After when Google sends it; otherwise exponential backoff with jitter (1s, 2s, 4s, 8s...)."""
        if resp is not None:
            header = resp.headers.get("retry-after")
            if header:
                try:
                    return min(float(header), 30.0)
                except ValueError:
                    pass
        return min(2.0 ** (attempt - 1), 16.0) + random.uniform(0.0, 0.5)

    async def _post_with_retry(
        self,
        endpoint: str,
        json_payload: dict,
        retries: int = 5,
        deadline_seconds: float = 100.0,
    ) -> httpx.Response:
        """
        HTTP POST that rides out transient failures (network errors, 429, 5xx - Gemini regularly answers
        503 "high demand"). Raises ProviderUnavailableError once retries are exhausted and
        ProviderRequestError for non-retryable 4xx responses, so callers get a clean 503/502, not a 500.
        """
        url = f"{self.base_url}{endpoint}"
        last_reason = "unknown error"
        started = time.monotonic()

        for attempt in range(1, retries + 1):
            resp: Optional[httpx.Response] = None
            remaining = deadline_seconds - (time.monotonic() - started)
            if remaining <= 1.0:
                break
            try:
                # Never let a single attempt outlive the overall deadline (the Node caller gives up at ~120s).
                attempt_timeout = httpx.Timeout(min(self.timeout.read or 60.0, remaining), connect=10.0)
                async with httpx.AsyncClient(timeout=attempt_timeout) as client:
                    resp = await client.post(url, json=json_payload, headers=self._headers)
            except httpx.TransportError as exc:  # connect/read timeouts, resets, DNS, protocol errors
                last_reason = f"{type(exc).__name__}"
            else:
                if resp.status_code == 429 or resp.status_code >= 500:
                    last_reason = self._error_message(resp)
                elif resp.status_code >= 400:
                    message = self._error_message(resp)
                    if resp.status_code in (401, 403):
                        message = "The Gemini API key was rejected (check GEMINI_API_KEY and its permissions)."
                    elif resp.status_code == 404:
                        message = f"Gemini model or endpoint not found ({endpoint.split('/')[-1]})."
                    raise ProviderRequestError(f"Gemini rejected the request: {message}")
                else:
                    return resp

            if attempt == retries:
                break
            wait_seconds = self._retry_delay(attempt, resp)
            if time.monotonic() - started + wait_seconds >= deadline_seconds:
                break
            logger.warning(
                f"Gemini {endpoint.split('/')[-1]} failed (attempt {attempt}/{retries}): {last_reason}. "
                f"Retrying in {wait_seconds:.1f}s..."
            )
            await asyncio.sleep(wait_seconds)

        raise ProviderUnavailableError(
            f"The AI model is temporarily unavailable ({last_reason}). Please try again in a moment."
        )

    def _embed_request(self, text: str) -> dict:
        return {
            "model": f"models/{self.embedding_model}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self.dimension,
        }

    async def embed_text(self, text: str) -> list[float]:
        clean_text = self._sanitize_text(text)
        if not clean_text:
            raise InvalidInputError("Cannot embed empty text.")
        resp = await self._post_with_retry(
            f"/models/{self.embedding_model}:embedContent",
            self._embed_request(clean_text),
        )
        values = resp.json().get("embedding", {}).get("values")
        if not values:
            raise ProviderRequestError("Invalid response from Gemini embedding API: no vector returned.")
        self._check_dimension(values)
        return self._l2_normalize(values)

    def _check_dimension(self, values: list[float]) -> None:
        if len(values) != self.dimension:
            raise ProviderRequestError(
                f"Embedding has {len(values)} dimensions but EMBEDDING_DIMENSION is {self.dimension}."
            )

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        clean_texts = [self._sanitize_text(t) for t in texts]
        results: list[list[float]] = []
        # Gemini batchEmbedContents accepts up to 100 requests per call.
        for i in range(0, len(clean_texts), 100):
            group = clean_texts[i:i + 100]
            non_empty_idx = [j for j, t in enumerate(group) if t]
            vectors: dict[int, list[float]] = {}
            if non_empty_idx:
                resp = await self._post_with_retry(
                    f"/models/{self.embedding_model}:batchEmbedContents",
                    {"requests": [self._embed_request(group[j]) for j in non_empty_idx]},
                )
                embs = resp.json().get("embeddings", [])
                if len(embs) != len(non_empty_idx):
                    raise ProviderRequestError("Gemini batch embedding returned unexpected number of vectors.")
                for j, emb in zip(non_empty_idx, embs):
                    values = emb.get("values")
                    if not values:
                        raise ProviderRequestError("Gemini batch embedding returned an empty vector.")
                    self._check_dimension(values)
                    vectors[j] = self._l2_normalize(values)
            for j in range(len(group)):
                results.append(vectors.get(j, [0.0] * self.dimension))
        return results

    def _build_payload(
        self,
        prompt: str,
        system_prompt: Optional[str],
        history: Optional[list[dict[str, str]]],
    ) -> dict:
        contents: list[dict] = []
        if history:
            for item in history[-4:]:
                if not item.get("content"):
                    continue
                role = "model" if item["role"].lower() in ("assistant", "model") else "user"
                # Gemini expects the conversation to begin with a user turn
                if not contents and role == "model":
                    continue
                contents.append({"role": role, "parts": [{"text": item["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload: dict = {
            "contents": contents,
            "generationConfig": {"temperature": 0.2},
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        return payload

    @staticmethod
    def _extract_text(data: dict) -> str:
        candidates = data.get("candidates") or []
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> str:
        payload = self._build_payload(prompt, system_prompt, history)
        fallback = settings.gemini_llm_fallback_model
        has_fallback = bool(fallback) and fallback != self.llm_model
        try:
            # With a fallback available, fail over quickly instead of hammering an overloaded model.
            resp = await self._post_with_retry(
                f"/models/{self.llm_model}:generateContent",
                payload,
                retries=2 if has_fallback else 5,
                deadline_seconds=45.0 if has_fallback else 100.0,
            )
        except ProviderUnavailableError:
            if not has_fallback:
                raise
            logger.warning(f"Primary model {self.llm_model} unavailable; falling back to {fallback}.")
            resp = await self._post_with_retry(
                f"/models/{fallback}:generateContent", payload, retries=4, deadline_seconds=60.0
            )
        return self._extract_text(resp.json()).strip()

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        payload = self._build_payload(prompt, system_prompt, history)
        url = f"{self.base_url}/models/{self.llm_model}:streamGenerateContent?alt=sse"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, json=payload, headers=self._headers) as response:
                if response.status_code >= 400:
                    await response.aread()
                    if response.status_code == 429 or response.status_code >= 500:
                        raise ProviderUnavailableError(
                            f"The AI model is temporarily unavailable ({self._error_message(response)})."
                        )
                    raise ProviderRequestError(f"Gemini rejected the request: {self._error_message(response)}")
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    try:
                        chunk = json.loads(line[5:].strip())
                    except json.JSONDecodeError:
                        continue
                    text = self._extract_text(chunk)
                    if text:
                        yield text
