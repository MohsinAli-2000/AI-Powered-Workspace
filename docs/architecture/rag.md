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
| AI Service | Python + FastAPI | Real-time RAG orchestration and answer generation |
| AI Worker | Python | Asynchronous document processing and embedding generation |
| Embedding Model | Gemini API `gemini-embedding-001` (768-dim); Ollama optional | Text-to-vector conversion |
| LLM | Gemini API `gemini-3.8-flash`; Qwen via Ollama optional | Answer generation |
| Vector Store | pgvector (PostgreSQL) | Similarity search |

### Embedding Model Selection

> **Current Default:** `gemini-embedding-001` via Gemini API (`AI_PROVIDER=gemini`, 768 dimensions, L2 unit-normalized, HNSW index). Switching providers requires re-embedding existing chunks.  
> **Local Alternative:** `nomic-embed-text` via Ollama (`AI_PROVIDER=ollama`, 768 dimensions).  
> **Production Consideration:** Can be swapped transparently for OpenAI `text-embedding-3-small` or cloud endpoints with matching 768 or re-indexed dimensions.

### LLM Selection

> **Current Default:** `gemini-3.8-flash` via Gemini API (`AI_PROVIDER=gemini`, configured with `GEMINI_API_KEY`, `GEMINI_LLM_MODEL`).  
> **Local Alternative:** `qwen2.5:1.5b` via Ollama for fast, lightweight local CPU execution (with `qwen2.5:latest` 7.6B supported on GPU/cloud instances).  
> **Production Consideration:** Ollama self-hosted on GPU EC2 instance or cloud API provider (OpenAI GPT-4o-mini / Anthropic Claude 3.5 Haiku).

---

## 3. Document Processing Flow (Async — AI Worker)

```text
User uploads document
        ↓
Backend validates request (auth, permissions, file type, size, duplicate check)
        ↓
File stored in object storage
        ↓
Document record created (status = QUEUED)
        ↓
Job published to RabbitMQ (PROCESS_DOCUMENT)
        ↓
        [Async from here]
        ↓
Worker picks up job
        ↓
Document status → PROCESSING
        ↓
Worker downloads file from object storage
        ↓
Content extraction (PDF, DOCX, XLSX, TXT, PPTX)
        ↓
Content normalization / cleaning
        ↓
Chunking (split into manageable segments)
        ↓
Embedding generation (via Embedding Model / Ollama)
        ↓
Store chunks + embeddings in PostgreSQL (pgvector)
        ↓
Document status → READY (success) or FAILED (failure)
        ↓
Worker ACKs or NACKs job to RabbitMQ
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
Backend → AI Service (internal request, with user's auth scope)
        ↓
AI Service embeds question (Embedding Model)
        ↓
AI Service performs similarity search (pgvector)
    WHERE organization_id = active_org
    AND document is accessible to this user
    AND (optional) project_id IN conversation_projects
        ↓
AI Service receives relevant chunks + metadata
        ↓
AI Service builds grounded context (Prompt Builder)
        ↓
AI Service sends [question + context] to LLM
        ↓
LLM generates answer
        ↓
AI Service builds source/citation metadata
        ↓
AI Service → Backend: Answer + source references
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

| Format | MVP Support |
|--------|------------|
| PDF | ✅ |
| DOCX | ✅ |
| XLSX | ✅ |
| TXT | ✅ |
| PPTX | ✅ |
| Image-only files | ❌ (not MVP — no OCR) |

---

## 10. Document Versioning in RAG

Documents support multiple versions.

- Each version has its own processing status, chunks, and embeddings.
- Historical versions are preserved (not deleted on new upload).
- By default, RAG retrieval uses chunks from the **current version** of a document.
- Source provenance should identify which version supported an answer, enabling answers like:
  > "Previously this was X, but now it has changed to Y."

---

## 11. Design Decisions & Implementation Status
 
| Item | Status | Implementation Details |
|------|--------|------------------------|
| Exact embedding model | ✅ Confirmed | `gemini-embedding-001` (768-dim L2-normalized) via Gemini API (default); `nomic-embed-text` via Ollama |
| Exact LLM model | ✅ Confirmed | `gemini-3.8-flash` via Gemini API (default); `qwen2.5:1.5b` via Ollama |
| Production LLM provider | ✅ Confirmed | Gemini API (DEC-030) with local Ollama fallback |
| Chunking strategy | ✅ Confirmed | 1000 characters chunk window, 200 characters overlap with paragraph/sentence/word boundary snapping (`apps/worker/src/chunker.py`) |
| Similarity threshold | ✅ Confirmed | Configurable cosine threshold (`MIN_SIMILARITY_SCORE`) with prompt-level insufficient-evidence fallback (`FR-AI-005`) |
| Historical versions search | ✅ Confirmed | By default, vector retrieval strictly filters `v.is_current = true` and `v.status = 'READY'` chunks |
| Streaming vs. non-streaming | ✅ Confirmed | Dual support: synchronous `POST /api/v1/rag/query` and Server-Sent Events (SSE) `POST /api/v1/rag/stream` |
| Conversation history context | ✅ Confirmed | Chronological message history loaded from database and supplied as context in the prompt builder |
