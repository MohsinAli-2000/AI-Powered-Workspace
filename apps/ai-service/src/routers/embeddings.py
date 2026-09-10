from fastapi import APIRouter
from ..providers import get_embedding_provider
from ..schemas import (
    EmbeddingRequest,
    EmbeddingResponse,
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
)

router = APIRouter(prefix="/api/v1/embeddings", tags=["Embeddings"])


@router.post("", response_model=EmbeddingResponse)
async def generate_embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    """
    Generates a 768-dim normalized embedding vector for a single text.
    """
    provider = get_embedding_provider()
    vec = await provider.embed_text(body.text)
    return EmbeddingResponse(embedding=vec, dimension=len(vec))


@router.post("/batch", response_model=BatchEmbeddingResponse)
async def generate_batch_embeddings(body: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    """
    Generates 768-dim normalized embedding vectors for multiple texts.
    """
    provider = get_embedding_provider()
    vectors = await provider.embed_batch(body.texts)
    dim = len(vectors[0]) if vectors else 0
    return BatchEmbeddingResponse(
        embeddings=vectors,
        count=len(vectors),
        dimension=dim,
    )
