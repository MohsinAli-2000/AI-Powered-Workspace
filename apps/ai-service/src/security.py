import hmac
from fastapi import HTTPException, Request
from src.config import settings


async def require_internal_token(request: Request) -> None:
    """
    Shared-secret check for server-to-server calls (the Node API sends `X-Internal-Token`).

    When AI_SERVICE_TOKEN is not configured the check is skipped so local development keeps
    working, but the service logs a warning at startup (see main.py).
    """
    expected = settings.ai_service_token
    if not expected:
        return
    provided = request.headers.get("x-internal-token", "")
    if not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Missing or invalid internal service token.")
