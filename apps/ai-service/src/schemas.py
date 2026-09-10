from typing import Optional
from pydantic import BaseModel, Field


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text string to embed")


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dimension: int


class BatchEmbeddingRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, description="List of strings to embed")


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
    organization_id: str = Field(..., description="Target organization UUID")
    user_id: Optional[str] = Field(default=None, description="Requesting user UUID for access checks")
    is_org_owner: bool = Field(default=False, description="True if caller is organization OWNER")
    authorized_project_ids: list[str] = Field(default_factory=list, description="UUIDs of accessible projects")
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    similarity_threshold: Optional[float] = None
    top_k: Optional[int] = None


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    insufficient_information: bool
    latency_ms: float


class LLMChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    system_prompt: Optional[str] = None
    history: list[ConversationMessage] = Field(default_factory=list)


class LLMChatResponse(BaseModel):
    content: str


class ChunkTextRequest(BaseModel):
    text: str = Field(..., min_length=1)
    chunk_size: int = Field(default=1000, ge=100, le=4000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)


class ChunkTextResponse(BaseModel):
    chunks: list[str]
    total_chunks: int
