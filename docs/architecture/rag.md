# RAG System Design

> **Status:** Confirmed baseline — agreed design decisions.  
> **Sources:** System architecture, functional requirements, agreed product decisions.

---

## 1. Overview

The RAG (Retrieval-Augmented Generation) system enables users to ask natural-language questions about their organizational documents and receive grounded answers with source references.

The RAG system is implemented as a **separate Python AI Service** (FastAPI) and a **Python AI Worker**, both operating within the private application layer — never directly accessible from the public internet.

---

## 2. RAG Architecture

### Components

| Component | Technology | Responsibility |
|-----------|-----------|---------------|
| AI Service | Python + FastAPI | Question embeddings and LLM answer generation. RAG orchestration endpoints exist here but the live chat path runs retrieval and prompt building in the Node API |
| AI Worker | Python | Asynchronous document processing and embedding generation |
| Vision Model | Google Gemini API (`gemini-3.6-flash`, with `gemini-3-flash-preview` / `gemini-flash-lite-latest` fallback) | Multimodal OCR, table transcription, and visual diagram/workflow understanding |
| Embedding Model | Google Gemini API `gemini-embedding-001` (768-dim, primary cloud provider); Ollama code kept for local reference | Text-to-vector conversion |
| LLM | Google Gemini API `gemini-3.6-flash` (primary cloud provider); Qwen via Ollama kept for local reference | Answer generation |
| Vector Store | pgvector (PostgreSQL) | Similarity search |

### Embedding Model Selection

> **Cloud Standard (Active):** `gemini-embedding-001` via Google Gemini API (`AI_PROVIDER=gemini`, 768 dimensions, L2 unit-normalized, HNSW index). Delivers high-throughput cloud vectorization with zero self-hosted infrastructure.  
> **Local Model Reference:** `nomic-embed-text` via Ollama (768 dimensions) code is preserved in commented form in `apps/worker/src/embeddings/ollama.py` and `apps/ai-service/src/providers/ollama.py` as a reference for local/offline execution.  

### LLM Selection

> **Cloud Standard (Active):** `gemini-3.6-flash` via Google Gemini API (`AI_PROVIDER=gemini`, configured with `GEMINI_API_KEY`). Provides high-speed enterprise-grade grounded reasoning, low latency token streaming, and resilient fallback sequence across `gemini-3-flash-preview`, `gemini-flash-lite-latest`, and `gemini-3.1-flash-lite`.  
> **Local Model Reference:** `qwen2.5` via Ollama code is preserved in commented form in `apps/ai-service/src/providers/ollama.py` and `apps/api/src/modules/conversations/ai-client.ts` as a guide for local CPU inference.  

### Multimodal Vision Model Selection

> **Production Standard:** `gemini-3.6-flash` multimodal vision (`GEMINI_VISION_MODEL=gemini-3.6-flash`) via Google Gemini API. Extracts text, tables, and transcribes architectural diagrams, workflows, and infographics from raster image files (`.png`, `.jpg`, `.jpeg`, `.jfif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.gif`) into structured GitHub-flavored Markdown.

---

## 3. Document Processing Flow (Async — AI Worker)

```text
User uploads document or image
        ↓
Backend validates request (auth, permissions, file type whitelist, 50MB cap, duplicate check)
        ↓
File stored in object storage (S3 / MinIO)
        ↓
Document record created (status = QUEUED)
        ↓
Version left QUEUED for the worker (DB polling; local dev spawns the processor)
        ↓
        [Async from here]
        ↓
Worker picks up job
        ↓
Document status → PROCESSING
        ↓
Worker downloads file stream from object storage
        ↓
Content extraction:
  - Text & Office: PDF, DOCX, XLSX, TXT, PPTX
  - Images & Diagrams: PNG, JPG, WEBP, BMP, TIFF, GIF (Multimodal AI Vision OCR)
        ↓
Content normalization & cleaning
        ↓
Chunking (1000-char window, 200-char overlap, boundary snapping)
        ↓
Embedding generation (Google Gemini API gemini-embedding-001, 768-dim)
        ↓
Store chunks + embeddings in PostgreSQL (pgvector)
        ↓
Document status → READY (success) or FAILED (failure)
        ↓
Chunks + READY are committed in one transaction (no queue ack needed with DB polling)
```

### Processing Status Transitions

```text
QUEUED → PROCESSING → READY
QUEUED → PROCESSING → FAILED
```

### Job Types

| Job | Description |
|-----|-------------|
| `PROCESS_DOCUMENT` | Initial processing of a new document version |
| `REPROCESS_DOCUMENT` | Reprocess an existing document (e.g., after failure) |
| `DELETE_DOCUMENT_VECTORS` | Remove all vector chunks for a deleted document version |

> **Implementation note:** these job types are the original queue design. In the current code only document processing exists: reprocess re-queues a `FAILED` version, and vectors are removed by `ON DELETE CASCADE` when a document is deleted.

---

## 4. RAG Question-Answer Flow (Sync — AI Service)

```text
User asks question
        ↓
Frontend → Backend (Node.js)
        ↓
Backend authenticates user
        ↓
Backend validates organization context
        ↓
Backend checks membership and permissions
        ↓
Backend computes authorized document scope for user
        ↓
Backend → AI Service: embed the question (Embedding Model)
        ↓
Backend performs similarity search (pgvector)
    WHERE organization_id = active_org
    AND document is accessible to this user
    AND (optional) project_id IN conversation_projects
        ↓
Backend receives relevant chunks + metadata
        ↓
Backend builds grounded prompt (excerpts fenced as untrusted data)
        ↓
Backend → AI Service: generate answer from [question + context] (LLM)
        ↓
Backend stores the answer and its source citations (message_sources)
        ↓
Backend → Frontend: Final response
        ↓
Frontend: Display answer + sources
```

---

## 5. Authorization-Aware Retrieval (Critical)

Authorization must be evaluated **before** RAG retrieval. This is a hard requirement.

### Prohibited behaviors

The RAG system must NOT:
1. Retrieve unauthorized chunks
2. Send unauthorized chunks to the LLM
3. Reveal confidential information indirectly through answers
4. Allow a user to bypass permissions by rephrasing a question
5. Return results from another organization

### Required filters on every similarity search

```sql
-- Conceptual filter (not literal SQL)
WHERE chunk.organization_id = :active_org_id
  AND chunk.document_id IN (
    SELECT document_id
    FROM authorized_documents_for_user(:user_id, :org_id)
  )
```

**A similarity search without tenant and authorization filters is never allowed.**

> **Implementation note:** this filter is implemented twice: in the Node API (`apps/api/src/modules/conversations/rag.repository.ts`, used by chat) and in the AI service (`apps/ai-service/src/db.py`, used only by its `/rag/*` endpoints). They have already drifted (the Python copy also requires `organizations.status = 'ACTIVE'`). Keep them in sync or remove one.

---

## 6. Conversation Scope and Retrieval

- A user can create a conversation without selecting a project — this is valid.
- Absence of a project selection does NOT mean unrestricted access.
- The retrieval system searches only across documents the user is **actually authorized** to access.
- If a conversation has selected projects, those projects act as an **additional retrieval scope filter** (narrowing results further).
- Selecting a project in a conversation **never grants** project membership or document access.

---

## 7. RAG Provenance / Source References

Every AI-generated answer must be traceable to its source documents.

### Provenance chain

```text
Message
  → Message Sources
    → Document Chunk
      → Document Version
        → Document
          → Project
            → Organization
```

### Source information exposed in UI (eventual)

- Department / Project name
- Document name
- Document version
- Page number (where available)

The purpose is **transparency and auditability** of AI-generated answers.

---

## 8. Handling Insufficient Information

If the system cannot retrieve sufficient relevant information:

> The system shall inform the user that the available knowledge base does not contain enough information to provide a reliable answer.

The system should **not** confidently invent information when relevant evidence is unavailable.

This behavior must be enforced through:
- LLM system prompt instructions
- Confidence thresholds on retrieved chunks (if implemented)

---

## 9. Supported Document Formats

| Format | Status | Extraction Method |
|--------|--------|-------------------|
| PDF (`.pdf`) | ✅ Supported | `PdfExtractor` (pypdf) |
| DOCX (`.docx`) | ✅ Supported | `DocxExtractor` (python-docx) |
| XLSX (`.xlsx`) | ✅ Supported | `XlsxExtractor` (openpyxl) |
| TXT (`.txt`) | ✅ Supported | `TxtExtractor` (UTF-8 safe decoding) |
| PPTX (`.pptx`) | ✅ Supported | `PptxExtractor` (python-pptx) |
| Raster Images (`.png`, `.jpg`, `.jpeg`, `.jfif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.gif`) | ✅ Supported | `ImageExtractor` (Google Gemini Vision API `gemini-3.6-flash`, Pillow format normalization, diagram transcription) |

---

## 10. Document Versioning in RAG

Documents support multiple versions.

- Each version has its own processing status, chunks, and embeddings.
- Historical versions are preserved (not deleted on new upload).
- By default, RAG retrieval uses chunks from the **current version** of a document.
- Source provenance should identify which version supported an answer, enabling answers like:
  > "Previously this was X, but now it has changed to Y."

---

## 11. LangChain Integration (AI Service)

The AI service builds its AI pipeline from **LangChain** components (`langchain-core`, `langchain-text-splitters`). These wrap the existing, hardened code and don't replace it. Gemini retries/backoff/model fallback, the permission-aware SQL, prompts and chunk output are unchanged (DEC-037).

| LangChain component | Class (`apps/ai-service/src/langchain_integration/`) | Wraps |
|---|---|---|
| `BaseChatModel` | `ProviderChatModel` (`chat_model.py`) | `providers/*` `generate` / `generate_stream` |
| `Embeddings` | `ProviderEmbeddings` (`embeddings.py`) | `providers/*` `embed_text` / `embed_batch` |
| `BaseRetriever` | `AuthorizedPgVectorRetriever` (`retriever.py`) | `db.search_authorized_chunks` (tenant + access filters) |
| `TextSplitter` | `BoundaryAwareTextSplitter` (`text_splitter.py`) | Original paragraph/sentence/word boundary chunker |

- `services/rag_service.py` composes **retriever → `ChatPromptTemplate` → `ProviderChatModel` → `StrOutputParser`** (LCEL). The chat model, embeddings and prompt are constructor-injectable.
- `routers/llm.py` (`/llm/chat`, `/llm/chat/stream`), `routers/embeddings.py` and `utils/chunk` run through the same components.
- **Extending:** add reranking or hybrid search by wrapping/replacing the retriever, switch models by passing another LangChain chat model, and add tracing (e.g. LangSmith) via LangChain callbacks. The API contract does not change.
- Tests: `apps/ai-service/tests/test_langchain_integration.py`.

---

## 12. Design Decisions & Implementation Status
 
| Item | Status | Implementation Details |
|------|--------|------------------------|
| Exact embedding model | ✅ Confirmed | Google Gemini API `gemini-embedding-001` (768-dim L2-normalized) in Production; `nomic-embed-text` via Ollama for Local Dev |
| Exact LLM model | ✅ Confirmed | Google Gemini API `gemini-3.6-flash` in Production; `qwen2.5:1.5b` via Ollama for Local Dev |
| Production AI provider | ✅ Confirmed | Google Gemini API (DEC-030) as primary cloud production provider; Ollama as local dev fallback |
| Chunking strategy | ✅ Confirmed | 1000 characters chunk window, 200 characters overlap with paragraph/sentence/word boundary snapping (`apps/worker/src/chunker.py`) |
| Similarity threshold | ✅ Confirmed | Configurable cosine threshold (`RAG_SIMILARITY_THRESHOLD`; the API's code default is `0.35`, the `.env.example` files use `0.45`) with an insufficient-evidence fallback (`FR-AI-005`). The API's value is the one that governs chat |
| Historical versions search | ✅ Confirmed | By default, vector retrieval strictly filters `v.is_current = true` and `v.status = 'READY'` chunks |
| Streaming vs. non-streaming | ✅ Implemented | Web chat streams via SSE: `POST /conversations/:id/messages/stream` (Node) → AI service `POST /api/v1/llm/chat/stream`; citations arrive in the final `done` event. The single-response `POST /conversations/:id/messages` is kept. `/rag/query` and `/rag/stream` remain unused |
| Orchestration framework | ✅ Confirmed | LangChain (`langchain-core`) in the AI service, wrapping the existing providers and search (§11, DEC-037) |
| Conversation history context | ✅ Confirmed | Chronological message history loaded from database and supplied as context in the prompt builder |
