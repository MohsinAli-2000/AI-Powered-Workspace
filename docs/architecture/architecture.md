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
| Frontend | Next.js + TypeScript | User interface and user experience |
| Core API | Node.js + TypeScript | SaaS business logic and authorization |
| AI API | Python + FastAPI | Real-time RAG and AI orchestration |
| AI Worker | Python | Asynchronous document processing |
| Relational Database | PostgreSQL | Core application data |
| Vector Store | pgvector | Embeddings and similarity search |
| Job Queue | RabbitMQ | Reliable background job delivery |
| Object Storage | MinIO (dev) → AWS S3 (prod) | Original uploaded documents |
| Embedding Runtime | Ollama (initially) | Text-to-vector conversion |
| LLM Runtime | Ollama (initially) | Answer generation |
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
        └──────────────► Resend (Email)

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

**Technology:** Node.js + TypeScript (Express.js router)

**Modules:**
- Auth Module (Register, Login, JWT Management, Refresh Token Rotation, Password Reset, Email Verification)
- User Module (Profile, Preferences)
- Organization Module (Create Organization, Settings, Plan & Usage)
- Membership Module (Add/Remove Members, Roles & Permissions, Invitations)
- Project Module (Create Project, Settings, Project Members)
- Document Module (Upload, Metadata, Status, Versioning, Delete)
- Conversation Module (Start, History, Message History)
- Permission / RBAC (Roles, Middleware)
- Background Job Publisher (Publish to RabbitMQ)
- Email Module (via Resend)
- Notification Module (In-app + Email notifications)
- Structured Logging + Tracing Context

---

## 7. AI Service

**Technology:** Python + FastAPI  
**Role:** Internal API — not exposed to the public internet directly

**Services:**
- Embedding Service (Generate embeddings via Ollama/OpenAI/HuggingFace)
- RAG Service (Semantic search via pgvector, retrieve relevant chunks, build context)
- LLM Service (Call LLM — OpenAI / Anthropic / Ollama, stream/non-stream)
- Utility Service (Text extraction, chunking strategies, file type handlers)

---

## 8. AI Worker

**Technology:** Python  
**Role:** Async document processing via RabbitMQ consumer

**Process flow per job:**
1. Get document metadata from PostgreSQL
2. Download original file from object storage
3. Extract text from document
4. Normalize and clean content
5. Split into chunks
6. Generate embeddings (via AI Service or directly)
7. Store chunks + embeddings in PostgreSQL (pgvector)
8. Update document status to READY / FAILED

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
- All services run via **Docker Compose**
- MinIO for object storage
- Local Ollama for embedding and LLM
- Local PostgreSQL with pgvector
- Local RabbitMQ

### Production (Cloud)
| Component | Deployment |
|-----------|-----------|
| Frontend | Vercel |
| Backend | EC2 / ECS / Render |
| AI Service | EC2 / ECS / Render (auto-scaling) |
| AI Worker | EC2 / ECS / Render |
| PostgreSQL | RDS (Managed) |
| RabbitMQ | Managed |
| Object Storage | AWS S3 |
| Monitoring | CloudWatch + Sentry |

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
