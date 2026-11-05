from typing import Optional
from langchain_core.callbacks import (
    AsyncCallbackManagerForRetrieverRun,
    CallbackManagerForRetrieverRun,
)
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.retrievers import BaseRetriever
from pydantic import ConfigDict, Field
from src.db import search_authorized_chunks
from src.langchain_integration.embeddings import ProviderEmbeddings


class AuthorizedPgVectorRetriever(BaseRetriever):
    """
    LangChain retriever over `document_chunks` that enforces the service's authorization model.

    Retrieval is delegated to `search_authorized_chunks`, so tenant isolation, document readiness,
    project scoping, the similarity threshold and DENY-precedence access rules are unchanged.
    A retriever instance is scoped to one request (one caller's permissions).
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    organization_id: str
    authorized_project_ids: list[str] = Field(default_factory=list)
    user_id: Optional[str] = None
    is_org_owner: bool = False
    similarity_threshold: float
    top_k: int
    embeddings: Embeddings = Field(default_factory=ProviderEmbeddings)

    async def _aget_relevant_documents(
        self, query: str, *, run_manager: AsyncCallbackManagerForRetrieverRun
    ) -> list[Document]:
        query_vector = await self.embeddings.aembed_query(query)

        rows = await search_authorized_chunks(
            query_vector=query_vector,
            organization_id=self.organization_id,
            authorized_project_ids=self.authorized_project_ids,
            threshold=self.similarity_threshold,
            top_k=self.top_k,
            user_id=self.user_id,
            is_org_owner=self.is_org_owner,
        )

        return [
            Document(
                page_content=row["content"],
                metadata={key: value for key, value in row.items() if key != "content"},
            )
            for row in rows
        ]

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> list[Document]:
        raise NotImplementedError(
            "AuthorizedPgVectorRetriever is async-only (asyncpg); use `ainvoke` instead of `invoke`."
        )
