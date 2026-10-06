# Architecture Overview

> **Status:** Confirmed baseline — agreed architecture decisions.  
> **Sources:** `docs/system-architecture.md`, `AI Powered Workspace Architecture Diagram.png`  
> **Style:** Modular SaaS + Separate AI Service

---

## 1. Architecture Principles

1. **Frontend never directly accesses the database, queue, or AI secrets.**
2. **Node.js backend owns authentication, authorization, organizations, and SaaS business rules.**
3. **Python owns AI-specific processing and RAG responsibilities.**
4. **Long-running document processing always happens asynchronously.**
5. **RabbitMQ messages contain references (e.g., `document_id`), not actual file content.**
6. **Original files live in object storage, not PostgreSQL.**
7. **PostgreSQL stores relational data, metadata, document chunks, and vectors (via pgvector).**
8. **Every tenant-owned resource must be scoped by `organization_id`.**
9. **Vector search must always apply organization and authorization filters.**
10. **The AI generates answers from retrieved knowledge and returns source references.**
11. **The worker is responsible for processing status transitions and retry-aware job execution.**
12. **Development infrastructure runs locally with Docker Compose where practical.**
13. **Production infrastructure can be swapped independently without rewriting core business logic.**
14. **Monitoring and error tracking are part of the architecture from day one.**
15. **The system starts as a small number of well-defined deployable applications, not dozens of unnecessary microservices.**

---

## 2. Component Responsibility Matrix

| Component | Technology | Primary Responsibility |
|-----------|-----------|----------------------|
| Frontend | Next.js 16 + TypeScript | User interface, dark-mode styling, SSE streaming chat, citation drawer |
| Core API | Node.js + Express 5 + TypeScript | SaaS business logic, authorization, rate limiting, audit logging |
| AI API | Python + FastAPI | Real-time RAG orchestration, SSE streaming, internal security token |
| AI Worker | Python | Asynchronous document processing, chunking, and embedding generation |
| Relational Database | PostgreSQL (Local / Neon Serverless) | Core relational application data |
| Vector Store | pgvector | 768-dim embeddings and HNSW similarity search |
| Job Queue | RabbitMQ | Reliable background job delivery with DLQ |
| Object Storage | MinIO (Local Dev Only) → AWS S3 (Production) | Original uploaded documents |
| Embedding Runtime | Google Gemini API default (`gemini-embedding-001`); Ollama for local dev | Text-to-vector conversion (768-dim) |
| LLM Runtime | Google Gemini API default (`gemini-3.8-flash`); Ollama for local dev | Grounded answer generation and streaming |
| Email | Nodemailer (Gmail SMTP) / Resend | Transactional emails |
| Monitoring | Sentry | Errors, performance, and tracing |

---

## 3. High-Level System Architecture

```
Next.js Frontend (HTTPS)
        │
        ▼
Node.js Core Backend
        │
        ├──────────────► PostgreSQL + pgvector
        │
        ├──────────────► Object Storage (MinIO / AWS S3)
        │
        ├──────────────► RabbitMQ ──────► Python AI Worker
        │                                      │
        │                                      ├── Content Extraction
        │                                      ├── Content Normalization
        │                                      ├── Chunking
        │                                      └── Embedding Pipeline
        │
        ├──────────────► Python FastAPI AI Service
        │                       │
        │                       ├── Retrieval Service
        │                       ├── RAG Orchestrator
        │                       ├── Prompt & Context Builder
        │                       └── Source / Citation Builder
        │
        └──────────────► Nodemailer / Resend (Email)

All Applications
        └──────────────► Sentry (Monitoring)
```

---

## 4. Deployment Boundary

```
PUBLIC INTERNET
│
├── Next.js Frontend
│
└── Node.js Backend API
        │
        │ Internal / Controlled Communication
        ▼
    ┌─────────────────────────────┐
    │ PRIVATE APPLICATION LAYER   │
    │                             │
    │  Python AI API (FastAPI)    │
    │  Python AI Worker           │
    │  RabbitMQ                   │
    │  PostgreSQL + pgvector      │
    │  Object Storage             │
    │  Ollama / AI Runtime        │
    └─────────────────────────────┘

EXTERNAL MANAGED SERVICES
│
├── Resend (email)
├── Sentry (monitoring)
└── AWS S3 (object storage, production)
```

---

## 5. Frontend

**Technology:** Next.js + TypeScript + React  
**State Management:** Zustand + React Query  
**UI Components:** Tailwind CSS + Shadcn/ui  
**Authentication:** JSON Web Tokens (JWT)

**Pages / Modules:**
- Authentication (Login / Signup)
- Dashboard
- Organizations
- Projects
- Documents (Upload & List)
- Chat / Ask Question
- Conversations
- Settings

**External auth note:** Architecture diagram shows optional OAuth (Google, GitHub, etc.) but this is not confirmed as an agreed MVP feature.  
> **TODO — DECISION REQUIRED:** Whether OAuth social login is in scope for MVP.

---

## 6. Core Backend

**Technology:** Node.js + TypeScript (Express.js 5)

**Modules:**
- Auth Module (Register, Login, JWT Dual-Token Rotation, Password Reset, Email Verification, Rate Limiting)
- User Module (Profile, Preferences, Account Settings)
- Organization Module (Create Organization, Settings, Ownership Transfer, Member Management)
- Membership Module (Add/Remove Members, Roles & Permissions, Invitations, ADMIN Minimum Count)
- Project Module (Create Project, Settings, Project Members, PROJECT_MANAGER Minimum Count)
- Document Module (Upload, Metadata, Status Polling, Versioning, Deduplication, Delete, Access Control)
- Document Access Control (PROJECT vs RESTRICTED, 6-step evaluation with DENY precedence)
- Conversation Module (Start, Thread History, Multi-turn RAG Orchestration, Source Citations)
- Audit Module (Append-only PostgreSQL Audit Logs, Non-fatal recording, OWNER/ADMIN queries)
- Permission / RBAC (Roles, Multi-tenant Isolation Middleware, Document Access Guards)
- Background Job Publisher (Publish to RabbitMQ with DLQ and connection reconnect resilience)
- Email Module (Nodemailer Gmail SMTP default & Resend custom domain support)
- Rate Limiting Middleware (In-memory IP fixed-window throttling for credential endpoints)
- Structured Logging + Tracing Context (Pino, Sentry)

---

## 7. AI Service

**Technology:** Python + FastAPI  
**Role:** Internal microservice — secured with `AI_SERVICE_TOKEN`, not exposed to the public internet directly

**Services & Endpoints:**
- Embedding Service (`POST /api/v1/embeddings`, `POST /api/v1/embeddings/batch` — Gemini `gemini-embedding-001` 768-dim default, Ollama `nomic-embed-text` alternative)
- Synchronous RAG Service (`POST /api/v1/rag/query` — pgvector search, XML prompt isolation, grounded answer generation, citations)
- Streaming RAG Service (`POST /api/v1/rag/stream` — real-time token streaming via Server-Sent Events `text/event-stream`)
- LLM Service (`POST /api/v1/llm/chat` — Gemini `gemini-3.8-flash` default, Ollama `qwen2.5:1.5b` alternative)
- Utility Service (`POST /api/v1/utils/chunk` — semantic sliding-window chunking)
- Database Pooling — Async PostgreSQL connection pool (`asyncpg`) with native pgvector type registration

---

## 8. AI Worker

**Technology:** Python  
**Role:** Async document processing via RabbitMQ consumer

**Process flow per job:**
1. Pick up job from RabbitMQ queue (`document-processing`) with Dead Letter Queue protection
2. Get document version metadata from PostgreSQL using `ThreadedConnectionPool`
3. Download original file from object storage (MinIO or AWS S3) with 50MB file size safeguard
4. Extract text from document (PDF, DOCX, XLSX, PPTX, TXT extractors with safe stream handling)
5. Normalize and clean content (NFKC Unicode normalization, null-byte stripping)
6. Split into chunks (1000 characters with 200 characters overlap and boundary snapping)
7. Generate embeddings in batches (Gemini `gemini-embedding-001` default, Ollama `nomic-embed-text` alternative)
8. Store chunks + 768-dim embeddings in PostgreSQL (pgvector)
9. Update document status to `READY` (with `processed_at`) or `FAILED`

---

## 9. Message Queue

**Technology:** RabbitMQ

**Queues:**
| Queue | Purpose |
|-------|---------|
| `document.process` | Initial document processing |
| `document.reprocess` | Reprocess a document (e.g., retry after failure) |
| `document.delete` | Delete document vectors from pgvector |
| `email.send` | Background email sending |
| `other.background.tasks` | Miscellaneous async tasks |

---

## 10. Data Storage

### PostgreSQL + pgvector

**Object storage key structure (conceptual):**
```
documents-bucket/
  └── org_{org_id}/
        └── project_{project_id}/
              └── document_{doc_id}/
                    └── original-file.pdf
```

**Development object storage:** MinIO (Docker)  
**Production object storage:** AWS S3

---

## 11. Email

**Technology:** Nodemailer (Gmail SMTP) & Resend (transactional email)  
**Status:** Confirmed & Implemented (`apps/api/src/modules/email/email.service.ts`)  
**Use cases:**
- Email verification
- Organization invitations
- Password reset

> **Resolution:** Nodemailer with Gmail SMTP (`smtp.gmail.com:465`) is supported as the default zero-cost, zero-domain provider (up to 500 emails/day), allowing immediate delivery to any recipient via standard Google App Passwords without requiring domain verification. Resend is supported for custom domain setups. If neither is configured, `email.service.ts` gracefully logs outgoing emails to the console in development mode to avoid breaking auth flows.

---

## 12. Monitoring

**Technology:** Sentry  
**Scope:** Frontend, Backend API, AI Service, AI Worker  
**Additional (from architecture diagram):** Logtail / ELK mentioned for log aggregation.

> **TODO — DECISION REQUIRED:** Log aggregation platform (Sentry only, Logtail, or ELK stack).

---

## 13. Development vs. Production

### Development (Local)
- **Object Storage:** MinIO (Local S3 emulator for development only)
- **AI Models:** Local Ollama (`nomic-embed-text` & `qwen2.5`) for offline dev/testing
- **Database:** Local PostgreSQL with pgvector (or Neon Serverless)
- **Message Broker:** Local RabbitMQ
- **Runtime:** Microservices run locally or via Docker Compose

### Production (Cloud)
| Component | Deployment |
|-----------|-----------|
| Frontend | Vercel / Cloud Container |
| Backend | AWS ECS / Render / Cloud Container |
| AI Service | AWS ECS / Render (FastAPI) |
| AI Worker | AWS ECS / Render (Python Worker) |
| PostgreSQL | Neon Serverless PostgreSQL / AWS RDS with pgvector |
| RabbitMQ | Managed RabbitMQ (CloudAMQP / AWS MQ) |
| Object Storage | AWS S3 (Production standard) |
| AI / LLM & Embeddings | Google Gemini API (`gemini-3.8-flash` & `gemini-embedding-001`) |
| Monitoring | Sentry |

> **TODO — DECISION REQUIRED:** Exact production deployment provider for backend, AI service, and worker.

---

## 14. CI/CD Pipeline

Conceptual pipeline (from architecture diagram):
```
GitHub → Tests → Build & Push Docker → Deploy
```

> **TODO — DECISION REQUIRED:** Exact CI/CD provider (GitHub Actions, etc.).

---

## 15. Security Chain

Every request follows this security chain:

```
User
  ↓
Authentication (JWT)
  ↓
Identify User ID
  ↓
Identify Active Organization
  ↓
Check Membership
  ↓
Check Role / Permission
  ↓
Access Requested Resource
```

Multi-tenant isolation is enforced on every organization-owned resource:

```
Request for Resource
  ↓
Verify: resource.organization_id = user's active organization_id
AND
Verify: user has permission for this action
```
