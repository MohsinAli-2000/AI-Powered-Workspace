from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from src.config import settings
from src.errors import ServiceError
from src.logger import logger
from src.db import get_db_pool, close_db_pool
from src.providers import get_embedding_provider
from src.routers import health, embeddings, rag, llm, utils
from src.security import require_internal_token

# Optional Sentry initialization
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0 if settings.environment == "development" else 0.1,
    )
    logger.info("Sentry monitoring initialized.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages startup and shutdown lifecycles, establishing and releasing DB pools.
    """
    logger.info(
        f"Starting AI Service on {settings.host}:{settings.port} "
        f"[env={settings.environment}, provider={settings.ai_provider}]"
    )
    if not settings.ai_service_token:
        logger.warning(
            "AI_SERVICE_TOKEN is not set: every endpoint is open to anyone who can reach this port. "
            "Set the same token in apps/ai-service/.env and apps/api/.env."
        )

    # Initialize DB connection pool
    try:
        await get_db_pool()
    except Exception as exc:
        logger.warning(f"Could not connect to PostgreSQL on startup: {exc}")

    # Build the model provider now so a missing API key is reported at startup, not on the first request.
    try:
        get_embedding_provider()
    except Exception as exc:
        logger.error(f"AI provider '{settings.ai_provider}' failed to initialize: {exc}")

    yield

    # Teardown DB connection pool
    logger.info("Shutting down AI Service...")
    await close_db_pool()


app = FastAPI(
    title="AI-Powered Workspace — Python AI Service",
    description="Internal microservice for embeddings, pgvector RAG, LLM completion, and chunking.",
    version="1.0.0",
    lifespan=lifespan,
)

# NOTE: no CORS middleware on purpose. This is a server-to-server service; browsers must never call it.


@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    logger.warning(f"{exc.code} on {request.method} {request.url.path}: {exc.message}")
    headers = {"Retry-After": "5"} if exc.status_code == 503 else None
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={"success": False, "error": exc.code, "message": exc.message},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    problems = "; ".join(
        f"{'.'.join(str(p) for p in err.get('loc', []) if p != 'body')}: {err.get('msg')}"
        for err in exc.errors()
    )
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "invalid_input",
            "message": f"Invalid request: {problems}",
            "detail": jsonable_errors(exc),
        },
    )


def jsonable_errors(exc: RequestValidationError) -> list[dict]:
    # `ctx` can hold non-serialisable objects (e.g. the original ValueError), so keep only plain fields.
    return [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    # Never echo internal exception text (DB hosts, URLs, SQL) back to callers.
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "internal_error",
            "message": "An unexpected error occurred in the AI Service.",
        },
    )


# Register Routers (health stays open for uptime checks; everything else needs the shared token)
protected = [Depends(require_internal_token)]
app.include_router(health.router)
app.include_router(embeddings.router, dependencies=protected)
app.include_router(rag.router, dependencies=protected)
app.include_router(llm.router, dependencies=protected)
app.include_router(utils.router, dependencies=protected)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
    )
