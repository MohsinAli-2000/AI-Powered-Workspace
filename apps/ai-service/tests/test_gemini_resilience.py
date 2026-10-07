import asyncio
from unittest.mock import AsyncMock, patch
import httpx
import pytest

from src.errors import ProviderRequestError, ProviderUnavailableError
from src.providers.gemini import GeminiProvider


@pytest.fixture
def base_provider():
    """GeminiProvider with zero retry delay for rapid testing."""
    return GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        embedding_model="text-embedding-004",
        dimension=768,
        max_retries=4,
        initial_retry_delay=0.01,
        max_retry_delay=0.05,
    )


# 1. Successful Gemini request
@pytest.mark.asyncio
async def test_successful_gemini_request():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Hello, world!"}]
                        }
                    }
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        client=mock_client,
    )

    result = await provider.generate("Test prompt")
    assert result == "Hello, world!"
    assert len(calls) == 1
    assert "gemini-3.6-flash" in str(calls[0].url)


# 2. First request gets 503, second succeeds
@pytest.mark.asyncio
async def test_first_request_503_second_succeeds():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, json={"error": {"code": 503, "message": "The model is overloaded."}})
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Recovered response"}]
                        }
                    }
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        max_retries=4,
        initial_retry_delay=0.0,
        max_retry_delay=0.0,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await provider.generate("Test prompt")
        assert result == "Recovered response"
        assert attempts == 2
        assert mock_sleep.call_count == 1


# 3. Repeated 503 until maximum retries
@pytest.mark.asyncio
async def test_repeated_503_exhausts_retries():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503, json={"error": {"code": 503, "message": "Service unavailable"}})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="",  # No fallback model configured
        max_retries=4,
        initial_retry_delay=0.0,
        max_retry_delay=0.0,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        with pytest.raises(ProviderUnavailableError) as exc_info:
            await provider.generate("Test prompt")

        assert "AI service is temporarily unavailable" in str(exc_info.value)
        assert attempts == 4
        assert mock_sleep.call_count == 3


# 4. 429 Rate Limit Handling (temporary quota exhausted)
@pytest.mark.asyncio
async def test_429_rate_limit_handled_with_backoff():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(
                429,
                headers={"retry-after": "2"},
                json={"error": {"code": 429, "message": "Resource has been exhausted"}},
            )
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": "Rate limit backoff succeeded"}]
                        }
                    }
                ]
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="",
        max_retries=4,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await provider.generate("Test prompt")
        assert result == "Rate limit backoff succeeded"
        assert attempts == 2
        assert mock_sleep.call_count == 1
        # Should have waited at least 2 seconds because of Retry-After header
        slept_time = mock_sleep.call_args[0][0]
        assert slept_time >= 2.0


# 5. Permanent 400 error does NOT retry
@pytest.mark.asyncio
async def test_permanent_400_does_not_retry():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(
            400,
            json={"error": {"code": 400, "message": "Invalid argument: malformed JSON body"}},
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        max_retries=4,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        with pytest.raises(ProviderRequestError) as exc_info:
            await provider.generate("Test prompt")

        assert "Invalid argument" in str(exc_info.value)
        assert attempts == 1  # Fails immediately on first attempt
        assert mock_sleep.call_count == 0


# 6. Authentication/Authorization error (401/403) does NOT retry
@pytest.mark.asyncio
async def test_authentication_error_does_not_retry():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(
            403,
            json={"error": {"code": 403, "message": "API key not valid. Please pass a valid API key."}},
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="bad-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        max_retries=4,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        with pytest.raises(ProviderRequestError) as exc_info:
            await provider.generate("Test prompt")

        assert "API key was rejected" in str(exc_info.value)
        assert attempts == 1  # Fails immediately without retrying or falling back
        assert mock_sleep.call_count == 0


# 7. Fallback model is used after primary model becomes unavailable (503)
@pytest.mark.asyncio
async def test_fallback_model_used_after_primary_unavailable():
    requests_log = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        requests_log.append(url_str)
        # Primary model repeatedly returns 503
        if "gemini-3.6-flash" in url_str:
            return httpx.Response(503, json={"error": {"code": 503, "message": "Model temporarily unavailable"}})
        # Fallback model succeeds
        if "gemini-3-flash-preview" in url_str:
            return httpx.Response(
                200,
                json={
                    "candidates": [
                        {
                            "content": {
                                "parts": [{"text": "Hello from fallback model!"}]
                            }
                        }
                    ]
                },
            )
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        primary_model="gemini-3.6-flash",
        fallback_model="gemini-3-flash-preview",
        max_retries=3,
        initial_retry_delay=0.0,
        max_retry_delay=0.0,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock):
        result = await provider.generate("Test prompt")
        assert result == "Hello from fallback model!"

        # Primary model was retried 3 times
        primary_calls = [u for u in requests_log if "gemini-3.6-flash" in u]
        assert len(primary_calls) == 3

        # Fallback model was then called and succeeded
        fallback_calls = [u for u in requests_log if "gemini-3-flash-preview" in u]
        assert len(fallback_calls) == 1


# 8. Embedding retry on transient 503 failure
@pytest.mark.asyncio
async def test_embedding_retry_on_503():
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, json={"error": {"code": 503, "message": "Overloaded"}})
        return httpx.Response(
            200,
            json={
                "embedding": {
                    "values": [0.1] * 768
                }
            },
        )

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    provider = GeminiProvider(
        api_key="test-api-key",
        embedding_model="text-embedding-004",
        dimension=768,
        max_retries=3,
        client=mock_client,
    )

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        vec = await provider.embed_text("Sample query for RAG retrieval")
        assert len(vec) == 768
        assert attempts == 2
        assert mock_sleep.call_count == 1
