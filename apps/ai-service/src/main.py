from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

from src.config import settings
from src.logger import logger
from src.db import get_db_pool, close_db_pool
from src.routers import health, embeddings, rag, llm, utils

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
    # Initialize DB connection pool
    try:
        await get_db_pool()
    except Exception as exc:
        logger.warning(f"Could not connect to PostgreSQL on startup: {exc}")

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

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal AI Service Error",
            "message": str(exc) if settings.environment == "development" else "An unexpected error occurred in the AI Service.",
        },
    )

# Register Routers
app.include_router(health.router)
app.include_router(embeddings.router)
app.include_router(rag.router)
app.include_router(llm.router)
app.include_router(utils.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
    )
