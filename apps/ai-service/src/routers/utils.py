from fastapi import APIRouter
from ..schemas import ChunkTextRequest, ChunkTextResponse
from ..services.utility_service import utility_service

router = APIRouter(prefix="/api/v1/utils", tags=["Utilities"])


@router.post("/chunk", response_model=ChunkTextResponse)
async def chunk_text_endpoint(body: ChunkTextRequest) -> ChunkTextResponse:
    """
    Splits text content into semantic chunks with configurable size and overlap.
    """
    chunks = utility_service.chunk_text(
        text=body.text,
        chunk_size=body.chunk_size,
        chunk_overlap=body.chunk_overlap,
    )
    return ChunkTextResponse(chunks=chunks, total_chunks=len(chunks))
