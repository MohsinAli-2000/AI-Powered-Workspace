from fastapi import APIRouter
from ..langchain_integration import ProviderEmbeddings
from ..schemas import (
    EmbeddingRequest,
    EmbeddingResponse,
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
)

router = APIRouter(prefix="/api/v1/embeddings", tags=["Embeddings"])

# LangChain Embeddings over the configured provider (resolved per call).
embeddings = ProviderEmbeddings()


@router.post("", response_model=EmbeddingResponse)
async def generate_embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    """
    Generates a 768-dim normalized embedding vector for a single text.
    """
    vec = await embeddings.aembed_query(body.text)
    return EmbeddingResponse(embedding=vec, dimension=len(vec))


@router.post("/batch", response_model=BatchEmbeddingResponse)
async def generate_batch_embeddings(body: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    """
    Generates 768-dim normalized embedding vectors for multiple texts.
    """
    vectors = await embeddings.aembed_documents(body.texts)
    dim = len(vectors[0]) if vectors else 0
    return BatchEmbeddingResponse(
        embeddings=vectors,
        count=len(vectors),
        dimension=dim,
    )
