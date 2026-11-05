"""
LangChain integration layer.

The service's hardened providers (Gemini retries/fallback, mock, Ollama) and the authorization-aware
pgvector search stay the single source of truth. This package exposes them as standard LangChain
components so the RAG pipeline can be composed with LCEL and new pieces (rerankers, other vector
stores, other chat models, tracing callbacks) can be swapped in without touching the routers.
"""
from src.langchain_integration.chat_model import ProviderChatModel, history_to_messages
from src.langchain_integration.embeddings import ProviderEmbeddings
from src.langchain_integration.retriever import AuthorizedPgVectorRetriever
from src.langchain_integration.text_splitter import BoundaryAwareTextSplitter

__all__ = [
    "ProviderChatModel",
    "ProviderEmbeddings",
    "AuthorizedPgVectorRetriever",
    "BoundaryAwareTextSplitter",
    "history_to_messages",
]
