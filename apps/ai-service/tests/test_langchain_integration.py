"""
Tests for the LangChain integration layer: the adapters must hand the providers and the
authorization-aware search exactly the same inputs the pre-LangChain code did.
"""
import json
from uuid import uuid4
import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from src.errors import ProviderUnavailableError
from src.langchain_integration import (
    AuthorizedPgVectorRetriever,
    BoundaryAwareTextSplitter,
    ProviderChatModel,
    ProviderEmbeddings,
    history_to_messages,
)
from src.langchain_integration import retriever as retriever_module
from src.langchain_integration.chat_model import messages_to_provider_args
from src.providers.base import BaseEmbeddingProvider, BaseLLMProvider
from src.schemas import RAGQueryRequest
from src.services.rag_service import (
    EMPTY_ANSWER_MESSAGE,
    INSUFFICIENT_INFO_MESSAGE,
    SYSTEM_PROMPT,
    RAGService,
)


class RecordingProvider(BaseEmbeddingProvider, BaseLLMProvider):
    def __init__(self, answer="Grounded answer.", tokens=("Hel", "lo"), error=None):
        self.calls: list = []
        self.answer = answer
        self.tokens = tokens
        self.error = error

    async def embed_text(self, text):
        self.calls.append(("embed_text", text))
        return [0.1, 0.2]

    async def embed_batch(self, texts):
        self.calls.append(("embed_batch", texts))
        return [[0.1, 0.2] for _ in texts]

    async def generate(self, prompt, system_prompt=None, history=None):
        self.calls.append(("generate", prompt, system_prompt, history))
        if self.error:
            raise self.error
        return self.answer

    async def generate_stream(self, prompt, system_prompt=None, history=None):
        self.calls.append(("generate_stream", prompt, system_prompt, history))
        for token in self.tokens:
            yield token
        if self.error:
            raise self.error


CHUNK = {
    "chunk_id": "c1",
    "content": "Revenue grew <b>12%</b> {q4}",
    "chunk_index": 4,
    "page_number": 2,
    "document_id": "doc-1",
    "document_name": 'Report "2026"',
    "project_id": "proj-1",
    "project_name": "Finance & Ops",
    "similarity": 0.83,
}


@pytest.fixture
def search_calls(monkeypatch):
    calls: list = []
    results: list = [dict(CHUNK)]

    async def fake_search(**kwargs):
        calls.append(kwargs)
        return [dict(r) for r in results]

    monkeypatch.setattr(retriever_module, "search_authorized_chunks", fake_search)
    calls_holder = {"calls": calls, "results": results}
    return calls_holder


def make_request(**overrides) -> RAGQueryRequest:
    body = {
        "question": "How did revenue change?",
        "organization_id": uuid4(),
        "user_id": uuid4(),
        "authorized_project_ids": [uuid4()],
        "conversation_history": [
            {"role": "USER", "content": "Hi"},
            {"role": "assistant", "content": "Hello!"},
        ],
    }
    body.update(overrides)
    return RAGQueryRequest(**body)


def make_service(provider: RecordingProvider) -> RAGService:
    return RAGService(
        chat_model=ProviderChatModel(provider=provider),
        embeddings=ProviderEmbeddings(provider=provider),
    )


# --- Chat model adapter ---------------------------------------------------------------------

def test_messages_map_back_to_provider_contract():
    messages = [
        SystemMessage(content="sys"),
        *history_to_messages([{"role": "USER", "content": "a"}, {"role": "system", "content": "b"}]),
        AIMessage(content="c"),
        HumanMessage(content="final {prompt}"),
    ]
    prompt, system_prompt, history = messages_to_provider_args(messages)
    assert prompt == "final {prompt}"
    assert system_prompt == "sys"
    # Original role strings are preserved exactly (providers apply their own role mapping).
    assert history == [
        {"role": "USER", "content": "a"},
        {"role": "system", "content": "b"},
        {"role": "assistant", "content": "c"},
    ]


def test_no_system_message_means_no_system_prompt():
    prompt, system_prompt, history = messages_to_provider_args([HumanMessage(content="hi")])
    assert (prompt, system_prompt, history) == ("hi", None, [])


async def test_chat_model_invoke_and_stream():
    provider = RecordingProvider(answer="done", tokens=("a", "b", "c"))
    model = ProviderChatModel(provider=provider)

    result = await model.ainvoke([HumanMessage(content="q")])
    assert result.content == "done"

    streamed = [chunk.content async for chunk in model.astream([HumanMessage(content="q")])]
    assert "".join(streamed) == "abc"
    assert provider.calls[0] == ("generate", "q", None, [])
    assert provider.calls[1] == ("generate_stream", "q", None, [])


async def test_chat_model_propagates_service_errors_unchanged():
    model = ProviderChatModel(provider=RecordingProvider(error=ProviderUnavailableError("busy")))
    with pytest.raises(ProviderUnavailableError, match="busy"):
        await model.ainvoke([HumanMessage(content="q")])


# --- Embeddings + retriever -----------------------------------------------------------------

async def test_embeddings_delegate_to_provider():
    provider = RecordingProvider()
    embeddings = ProviderEmbeddings(provider=provider)
    assert await embeddings.aembed_query("x") == [0.1, 0.2]
    assert await embeddings.aembed_documents(["a", "b"]) == [[0.1, 0.2], [0.1, 0.2]]
    assert provider.calls == [("embed_text", "x"), ("embed_batch", ["a", "b"])]


async def test_retriever_passes_authorization_scope(search_calls):
    retriever = AuthorizedPgVectorRetriever(
        organization_id="org",
        authorized_project_ids=["p1", "p2"],
        user_id="u1",
        is_org_owner=True,
        similarity_threshold=0.42,
        top_k=7,
        embeddings=ProviderEmbeddings(provider=RecordingProvider()),
    )
    docs = await retriever.ainvoke("question")

    assert search_calls["calls"] == [{
        "query_vector": [0.1, 0.2],
        "organization_id": "org",
        "authorized_project_ids": ["p1", "p2"],
        "threshold": 0.42,
        "top_k": 7,
        "user_id": "u1",
        "is_org_owner": True,
    }]
    assert docs[0].page_content == CHUNK["content"]
    assert docs[0].metadata["document_id"] == "doc-1"
    assert "content" not in docs[0].metadata


# --- RAG pipeline ---------------------------------------------------------------------------

async def test_rag_answer_builds_original_prompt(search_calls):
    provider = RecordingProvider()
    service = make_service(provider)
    request = make_request()

    response = await service.answer_query(request)

    assert response.answer == "Grounded answer."
    assert response.insufficient_information is False
    assert response.sources[0].document_name == 'Report "2026"'
    assert response.sources[0].excerpt == CHUNK["content"]

    _, prompt, system_prompt, history = provider.calls[-1]
    assert system_prompt == SYSTEM_PROMPT
    assert history == [{"role": "USER", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}]
    expected_context = (
        '<context_document id="1" title=\'Report "2026"\' project="Finance &amp; Ops" page="2">\n'
        "Revenue grew &lt;b&gt;12%&lt;/b&gt; {q4}\n"
        "</context_document>"
    )
    assert prompt == (
        "Here are the relevant document excerpts for context:\n\n"
        f"{expected_context}\n\n"
        "Question: How did revenue change?\n\n"
        "Answer:"
    )


async def test_rag_insufficient_information(search_calls):
    search_calls["results"].clear()
    provider = RecordingProvider()
    response = await make_service(provider).answer_query(make_request())
    assert response.answer == INSUFFICIENT_INFO_MESSAGE
    assert response.insufficient_information is True
    assert not any(c[0] == "generate" for c in provider.calls)


async def test_rag_empty_answer_fallback(search_calls):
    response = await make_service(RecordingProvider(answer="  ")).answer_query(make_request())
    assert response.answer == EMPTY_ANSWER_MESSAGE


async def test_rag_stream_events(search_calls):
    events = [e async for e in make_service(RecordingProvider()).stream_query(make_request())]
    assert events[0] == 'event: token\ndata: {"token": "Hel"}\n\n'
    assert events[1] == 'event: token\ndata: {"token": "lo"}\n\n'
    done = json.loads(events[2].split("data: ", 1)[1])
    assert events[2].startswith("event: done")
    assert done["insufficient_information"] is False
    assert done["sources"][0]["chunk_index"] == 4


async def test_rag_stream_reports_errors_as_events(search_calls):
    provider = RecordingProvider(error=ProviderUnavailableError("overloaded"))
    events = [e async for e in make_service(provider).stream_query(make_request())]
    assert events[-1] == 'event: error\ndata: {"message": "overloaded"}\n\n'


# --- Text splitter --------------------------------------------------------------------------

def test_splitter_snaps_to_boundaries_and_allows_large_overlap():
    text = ("Sentence one. Sentence two! " * 30 + "\n\n") * 3
    chunks = BoundaryAwareTextSplitter(chunk_size=200, chunk_overlap=40).split_text(text)
    assert all(len(c) <= 200 for c in chunks)
    assert all(c.endswith((".", "!")) for c in chunks[:-1])
    # Overlap larger than chunk size is accepted by the API and must not raise.
    assert BoundaryAwareTextSplitter(chunk_size=100, chunk_overlap=500).split_text("word " * 100)


def test_splitter_short_text_and_documents():
    splitter = BoundaryAwareTextSplitter(chunk_size=1000, chunk_overlap=200)
    assert splitter.split_text("") == []
    assert splitter.split_text("a\r\nb  ") == ["a\nb"]
    docs = splitter.create_documents(["hello"], metadatas=[{"source": "x"}])
    assert docs[0].page_content == "hello" and docs[0].metadata["source"] == "x"


# --- /api/v1/llm/chat/stream ----------------------------------------------------------------

def _stream_client(monkeypatch, provider):
    from fastapi.testclient import TestClient
    import src.providers as providers_module
    from src.main import app
    monkeypatch.setattr(providers_module, "_get_provider", lambda: provider)
    monkeypatch.setattr("src.security.settings.ai_service_token", None, raising=False)
    return TestClient(app)


def test_llm_chat_stream_endpoint(monkeypatch):
    provider = RecordingProvider(tokens=("Hel", "lo"))
    client = _stream_client(monkeypatch, provider)
    resp = client.post("/api/v1/llm/chat/stream", json={
        "prompt": "q", "system_prompt": "sys", "history": [{"role": "USER", "content": "hi"}]})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.text == (
        'event: token\ndata: {"token": "Hel"}\n\n'
        'event: token\ndata: {"token": "lo"}\n\n'
        "event: done\ndata: {}\n\n"
    )
    assert provider.calls == [("generate_stream", "q", "sys", [{"role": "USER", "content": "hi"}])]


def test_llm_chat_stream_endpoint_error(monkeypatch):
    client = _stream_client(monkeypatch, RecordingProvider(tokens=(), error=ProviderUnavailableError("busy")))
    resp = client.post("/api/v1/llm/chat/stream", json={"prompt": "q"})
    assert resp.text == 'event: error\ndata: {"message": "busy", "status_code": 503}\n\n'
