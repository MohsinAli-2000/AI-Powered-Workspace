import asyncio
import json
import math
from typing import AsyncIterator, Optional
import httpx
import numpy as np
from src.config import settings
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

    async def _post_with_retry(
        self, endpoint: str, json_payload: dict, retries: int = 3
    ) -> httpx.Response:
        """
        HTTP POST with exponential backoff for transient failures (network, 429, 5xx).
        """
        url = f"{self.base_url}{endpoint}"
        last_err: Optional[Exception] = None

        for attempt in range(1, retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(url, json=json_payload, headers=self._headers)
                    if resp.status_code == 429 or resp.status_code >= 500:
                        raise httpx.RemoteProtocolError(
                            f"HTTP {resp.status_code}: {resp.text[:200]}"
                        )
                    resp.raise_for_status()
                    return resp
            except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
                last_err = exc
                if attempt == retries:
                    break
                wait_seconds = math.pow(2, attempt - 1) * 1.0
                logger.warning(
                    f"Gemini request to {endpoint} failed (attempt {attempt}/{retries}): {exc}. Retrying in {wait_seconds:.1f}s..."
                )
                await asyncio.sleep(wait_seconds)

        raise RuntimeError(f"Gemini request to {endpoint} failed after {retries} attempts: {last_err}")

    def _embed_request(self, text: str) -> dict:
        return {
            "model": f"models/{self.embedding_model}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self.dimension,
        }

    async def embed_text(self, text: str) -> list[float]:
        clean_text = self._sanitize_text(text)
        if not clean_text:
            return [0.0] * self.dimension
        resp = await self._post_with_retry(
            f"/models/{self.embedding_model}:embedContent",
            self._embed_request(clean_text),
        )
        values = resp.json().get("embedding", {}).get("values")
        if not values:
            raise ValueError("Invalid response from Gemini embedding API: no vector returned.")
        return self._l2_normalize(values)

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
                    raise ValueError("Gemini batch embedding returned unexpected number of vectors.")
                for j, emb in zip(non_empty_idx, embs):
                    vectors[j] = self._l2_normalize(emb["values"])
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
                role = "model" if item["role"].lower() in ("assistant", "model") else "user"
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
        resp = await self._post_with_retry(
            f"/models/{self.llm_model}:generateContent", payload
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
                response.raise_for_status()
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
