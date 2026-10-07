import asyncio
import json
import random
import time
from typing import AsyncIterator, Optional, List
import httpx
import numpy as np
from src.config import settings
from src.errors import InvalidInputError, ProviderRequestError, ProviderUnavailableError
from src.logger import logger
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider


def extract_gemini_error_message(resp: httpx.Response) -> str:
    """Safe, sanitized description of a Gemini error response (no URLs, no authorization tokens)."""
    try:
        data = resp.json()
        error_obj = data.get("error", {})
        msg = error_obj.get("message")
        if msg:
            return str(msg)[:250]
        return f"HTTP {resp.status_code}"
    except (ValueError, TypeError):
        return f"HTTP {resp.status_code}"


class GeminiProvider(BaseEmbeddingProvider, BaseLLMProvider):
    """
    Asynchronous client for the Google Gemini API (embeddings + generation)
    hardened with exponential backoff retries, jitter, separate 429 quota handling,
    model fallback, and clean application-level exceptions.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        embedding_model: Optional[str] = None,
        primary_model: Optional[str] = None,
        fallback_model: Optional[str] = None,
        dimension: Optional[int] = None,
        max_retries: Optional[int] = None,
        initial_retry_delay: Optional[float] = None,
        max_retry_delay: Optional[float] = None,
        timeout_seconds: Optional[float] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        resolved_key = api_key if api_key is not None else settings.gemini_api_key
        if not resolved_key:
            raise RuntimeError("GEMINI_API_KEY is not set but AI_PROVIDER=gemini")
        self.api_key: str = resolved_key
        self.base_url = (base_url or settings.gemini_base_url).rstrip("/")
        self.embedding_model = embedding_model or settings.gemini_embedding_model
        self.primary_model = primary_model or settings.gemini_primary_model
        self.fallback_model = (
            fallback_model if fallback_model is not None else settings.gemini_fallback_model
        )
        self.dimension = dimension or settings.embedding_dimension
        self.max_retries = (
            max_retries if max_retries is not None else settings.gemini_max_retries
        )
        self.initial_retry_delay = (
            initial_retry_delay
            if initial_retry_delay is not None
            else settings.gemini_initial_retry_delay
        )
        self.max_retry_delay = (
            max_retry_delay
            if max_retry_delay is not None
            else settings.gemini_max_retry_delay
        )
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.gemini_timeout_seconds
        )
        self.timeout = httpx.Timeout(self.timeout_seconds, connect=10.0)
        self._client = client

    @property
    def llm_model(self) -> str:
        return self.primary_model

    @llm_model.setter
    def llm_model(self, val: str) -> None:
        self.primary_model = val

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

    def _calculate_retry_delay(
        self, attempt: int, resp: Optional[httpx.Response] = None
    ) -> float:
        """
        Computes exponential backoff with jitter:
        attempt 1 -> 1.0s + jitter
        attempt 2 -> 2.0s + jitter
        attempt 3 -> 4.0s + jitter
        attempt 4 -> 8.0s + jitter
        Honors Retry-After header when provided by Google, capped at max_retry_delay.
        """
        if resp is not None:
            header = resp.headers.get("retry-after")
            if header:
                try:
                    parsed = float(header)
                    return min(parsed, self.max_retry_delay) + random.uniform(0.0, 0.5)
                except ValueError:
                    pass
        base = min(self.initial_retry_delay * (2 ** (attempt - 1)), self.max_retry_delay)
        jitter = random.uniform(0.0, 0.5)
        return min(base + jitter, self.max_retry_delay + 0.5)

    async def _post_with_retry(
        self,
        endpoint: str,
        json_payload: dict,
        model_name: str,
        retries: Optional[int] = None,
        deadline_seconds: Optional[float] = None,
    ) -> httpx.Response:
        """
        HTTP POST that rides out transient failures (503, 500, 502, 504, network drops, and 429)
        with exponential backoff and jitter. Permanent client errors (400, 401, 403, 404, 422) fail
        immediately without retrying.
        """
        url = f"{self.base_url}{endpoint}"
        max_attempts = retries if retries is not None else self.max_retries
        deadline = deadline_seconds if deadline_seconds is not None else 100.0
        started = time.monotonic()
        last_status = "unknown"

        for attempt in range(1, max_attempts + 1):
            resp: Optional[httpx.Response] = None
            remaining = deadline - (time.monotonic() - started)
            if remaining <= 1.0:
                break
            try:
                attempt_timeout = httpx.Timeout(min(self.timeout_seconds, remaining), connect=10.0)
                if self._client is not None:
                    resp = await self._client.post(url, json=json_payload, headers=self._headers)
                else:
                    async with httpx.AsyncClient(timeout=attempt_timeout) as client:
                        resp = await client.post(url, json=json_payload, headers=self._headers)
            except httpx.TransportError as exc:
                last_status = type(exc).__name__
                if attempt == max_attempts:
                    logger.error(
                        f"Gemini request failed permanently: status={last_status}, model={model_name}, attempts={attempt}/{max_attempts}. All retries exhausted."
                    )
                    break
                wait_seconds = self._calculate_retry_delay(attempt, None)
                logger.warning(
                    f"Gemini request failed: status={last_status}, model={model_name}, attempt={attempt}/{max_attempts}, retry_in={wait_seconds:.1f}s"
                )
                if time.monotonic() - started + wait_seconds >= deadline:
                    break
                await asyncio.sleep(wait_seconds)
                continue

            status = resp.status_code
            last_status = str(status)

            if status == 200:
                return resp

            # Permanent Errors (400, 401, 403, 404, 422) - MUST NOT BE RETRIED
            if status in (401, 403):
                logger.error(
                    f"Gemini request rejected permanently: status={status}, model={model_name}, error=The Gemini API key was rejected."
                )
                raise ProviderRequestError(
                    "The Gemini API key was rejected (check GEMINI_API_KEY and its permissions)."
                )
            if status in (400, 404, 422):
                err_msg = extract_gemini_error_message(resp)
                logger.warning(
                    f"Gemini request rejected permanently: status={status}, model={model_name}, error={err_msg}"
                )
                raise ProviderRequestError(f"Gemini rejected the request: {err_msg}")

            # Transient Errors: 429 (rate/quota limit) vs 500, 502, 503, 504 (server unavailability)
            is_rate_limit = (status == 429)

            if attempt == max_attempts:
                logger.error(
                    f"Gemini request failed permanently: status={status}, model={model_name}, attempts={attempt}/{max_attempts}. All retries exhausted."
                )
                break

            wait_seconds = self._calculate_retry_delay(attempt, resp)
            if time.monotonic() - started + wait_seconds >= deadline:
                logger.error(
                    f"Gemini request failed permanently: status={status}, model={model_name}, attempts={attempt}/{max_attempts}. Deadline exceeded."
                )
                break

            if is_rate_limit:
                logger.warning(
                    f"Gemini request rate limited (quota/rate limit): status=429, model={model_name}, attempt={attempt}/{max_attempts}, retry_in={wait_seconds:.1f}s"
                )
            else:
                logger.warning(
                    f"Gemini request failed: status={status}, model={model_name}, attempt={attempt}/{max_attempts}, retry_in={wait_seconds:.1f}s"
                )

            await asyncio.sleep(wait_seconds)

        raise ProviderUnavailableError(
            "AI service is temporarily unavailable. Please try again shortly."
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
            model_name=self.embedding_model,
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
        for i in range(0, len(clean_texts), 100):
            group = clean_texts[i:i + 100]
            non_empty_idx = [j for j, t in enumerate(group) if t]
            vectors: dict[int, list[float]] = {}
            if non_empty_idx:
                resp = await self._post_with_retry(
                    f"/models/{self.embedding_model}:batchEmbedContents",
                    {"requests": [self._embed_request(group[j]) for j in non_empty_idx]},
                    model_name=self.embedding_model,
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
        has_fallback = bool(self.fallback_model) and self.fallback_model != self.primary_model

        try:
            resp = await self._post_with_retry(
                f"/models/{self.primary_model}:generateContent",
                payload,
                model_name=self.primary_model,
                retries=self.max_retries,
            )
            return self._extract_text(resp.json()).strip()
        except ProviderUnavailableError:
            if not has_fallback or not self.fallback_model:
                raise
            fallback = self.fallback_model
            logger.warning(
                f"Primary model {self.primary_model} unavailable; attempting fallback model {fallback}."
            )
            resp = await self._post_with_retry(
                f"/models/{fallback}:generateContent",
                payload,
                model_name=fallback,
                retries=self.max_retries,
            )
            return self._extract_text(resp.json()).strip()

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[list[dict[str, str]]] = None,
    ) -> AsyncIterator[str]:
        payload = self._build_payload(prompt, system_prompt, history)
        models_to_try = [self.primary_model]
        if self.fallback_model and self.fallback_model != self.primary_model:
            models_to_try.append(self.fallback_model)

        for model_idx, model_name in enumerate(models_to_try):
            is_fallback = model_idx > 0
            if is_fallback:
                logger.warning(
                    f"Primary model {self.primary_model} unavailable for streaming; attempting fallback model {model_name}."
                )

            url = f"{self.base_url}/models/{model_name}:streamGenerateContent?alt=sse"
            for attempt in range(1, self.max_retries + 1):
                try:
                    if self._client is not None:
                        client_ctx = self._client
                        # External mock/test client
                        async with client_ctx.stream("POST", url, json=payload, headers=self._headers) as response:
                            if response.status_code == 200:
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
                                return

                            await response.aread()
                            status = response.status_code
                            if status in (401, 403):
                                logger.error(
                                    f"Gemini request rejected permanently: status={status}, model={model_name}, error=The Gemini API key was rejected."
                                )
                                raise ProviderRequestError("The Gemini API key was rejected (check GEMINI_API_KEY and its permissions).")
                            if status in (400, 404, 422):
                                err_msg = extract_gemini_error_message(response)
                                logger.warning(
                                    f"Gemini request rejected permanently: status={status}, model={model_name}, error={err_msg}"
                                )
                                raise ProviderRequestError(f"Gemini rejected the request: {err_msg}")

                            is_rate_limit = (status == 429)
                            if attempt == self.max_retries:
                                logger.error(
                                    f"Gemini request failed permanently: status={status}, model={model_name}, attempts={attempt}/{self.max_retries}. All retries exhausted."
                                )
                                break

                            wait_seconds = self._calculate_retry_delay(attempt, response)
                            if is_rate_limit:
                                logger.warning(
                                    f"Gemini request rate limited (quota/rate limit): status=429, model={model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                                )
                            else:
                                logger.warning(
                                    f"Gemini request failed: status={status}, model={model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                                )
                            await asyncio.sleep(wait_seconds)
                    else:
                        async with httpx.AsyncClient(timeout=self.timeout) as client:
                            async with client.stream("POST", url, json=payload, headers=self._headers) as response:
                                if response.status_code == 200:
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
                                    return

                                await response.aread()
                                status = response.status_code
                                if status in (401, 403):
                                    logger.error(
                                        f"Gemini request rejected permanently: status={status}, model={model_name}, error=The Gemini API key was rejected."
                                    )
                                    raise ProviderRequestError("The Gemini API key was rejected (check GEMINI_API_KEY and its permissions).")
                                if status in (400, 404, 422):
                                    err_msg = extract_gemini_error_message(response)
                                    logger.warning(
                                        f"Gemini request rejected permanently: status={status}, model={model_name}, error={err_msg}"
                                    )
                                    raise ProviderRequestError(f"Gemini rejected the request: {err_msg}")

                                is_rate_limit = (status == 429)
                                if attempt == self.max_retries:
                                    logger.error(
                                        f"Gemini request failed permanently: status={status}, model={model_name}, attempts={attempt}/{self.max_retries}. All retries exhausted."
                                    )
                                    break

                                wait_seconds = self._calculate_retry_delay(attempt, response)
                                if is_rate_limit:
                                    logger.warning(
                                        f"Gemini request rate limited (quota/rate limit): status=429, model={model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                                    )
                                else:
                                    logger.warning(
                                        f"Gemini request failed: status={status}, model={model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                                    )
                                await asyncio.sleep(wait_seconds)

                except httpx.TransportError as exc:
                    if attempt == self.max_retries:
                        logger.error(
                            f"Gemini request failed permanently: status={type(exc).__name__}, model={model_name}, attempts={attempt}/{self.max_retries}. All retries exhausted."
                        )
                        break
                    wait_seconds = self._calculate_retry_delay(attempt, None)
                    logger.warning(
                        f"Gemini request failed: status={type(exc).__name__}, model={model_name}, attempt={attempt}/{self.max_retries}, retry_in={wait_seconds:.1f}s"
                    )
                    await asyncio.sleep(wait_seconds)

        raise ProviderUnavailableError("AI service is temporarily unavailable. Please try again shortly.")

