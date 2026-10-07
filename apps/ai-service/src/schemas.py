from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


def _require_text(value: str) -> str:
    """Whitespace-only input would embed to a zero vector, so reject it up front."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be empty or whitespace only")
    return stripped


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text string to embed")

    _strip = field_validator("text")(_require_text)


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dimension: int


class BatchEmbeddingRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100, description="List of strings to embed")


class BatchEmbeddingResponse(BaseModel):
    embeddings: list[list[float]]
    count: int
    dimension: int


class SourceCitation(BaseModel):
    document_id: str
    document_name: str
    project_id: str
    project_name: str
    chunk_index: int
    page_number: Optional[int] = None
    similarity: float
    excerpt: str


class ConversationMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system|USER|ASSISTANT|SYSTEM)$")
    content: str = Field(..., min_length=1)


class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    organization_id: UUID = Field(..., description="Target organization UUID")
    user_id: Optional[UUID] = Field(default=None, description="Requesting user UUID for access checks")
    is_org_owner: bool = Field(default=False, description="True if caller is organization OWNER")
    authorized_project_ids: list[UUID] = Field(default_factory=list, max_length=500, description="UUIDs of accessible projects")
    conversation_history: list[ConversationMessage] = Field(default_factory=list, max_length=50)
    similarity_threshold: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    top_k: Optional[int] = Field(default=None, ge=1, le=50)

    _strip_question = field_validator("question")(_require_text)


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    insufficient_information: bool
    latency_ms: float


class LLMChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    system_prompt: Optional[str] = None
    history: list[ConversationMessage] = Field(default_factory=list, max_length=50)

    _strip_prompt = field_validator("prompt")(_require_text)


class LLMChatResponse(BaseModel):
    content: str


class ChunkTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    chunk_size: int = Field(default=1000, ge=100, le=4000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)


class ChunkTextResponse(BaseModel):
    chunks: list[str]
    total_chunks: int


class ImageExtractRequest(BaseModel):
    image_base64: str = Field(..., min_length=1, description="Base64 encoded image data")
    mime_type: str = Field(default="image/png", description="Image MIME type (e.g. image/png, image/jpeg, image/webp)")
    instruction: Optional[str] = Field(default=None, description="Optional custom extraction prompt")


class ImageExtractResponse(BaseModel):
    extracted_text: str
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
