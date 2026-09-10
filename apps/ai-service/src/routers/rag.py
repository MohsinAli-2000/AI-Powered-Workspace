from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from ..schemas import RAGQueryRequest, RAGQueryResponse
from ..services.rag_service import rag_service

router = APIRouter(prefix="/api/v1/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(body: RAGQueryRequest) -> RAGQueryResponse:
    """
    Executes synchronous RAG answering. Returns complete answer and source citations.
    """
    return await rag_service.answer_query(body)


@router.post("/stream")
async def stream_rag(body: RAGQueryRequest) -> StreamingResponse:
    """
    Streams RAG response tokens via Server-Sent Events (SSE).
    Concludes with an 'event: done' containing full source citations.
    """
    return StreamingResponse(
        rag_service.stream_query(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
