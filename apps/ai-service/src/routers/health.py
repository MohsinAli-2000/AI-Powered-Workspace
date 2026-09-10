from fastapi import APIRouter
from ..config import settings
from ..db import check_db_health

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/api/v1/health")
async def health_check():
    """
    Returns the readiness status of the AI Service, database connection, and configured AI provider.
    """
    db_healthy = await check_db_health()
    status_code = "healthy" if db_healthy else "degraded"

    return {
        "status": status_code,
        "service": "ai-service",
        "environment": settings.environment,
        "database": "connected" if db_healthy else "disconnected",
        "provider": settings.ai_provider,
        "embedding_model": settings.embedding_model,
        "llm_model": settings.llm_model,
    }
