# Project Status

> **Last synchronized:** 2026-09-01  
> **Purpose:** Single source of truth for project phase, completed work, in-progress work, and planned work.

---

## Current Phase

**Phase: Database Schema Implemented → Ready for Backend Foundation**

All core product decisions, architecture, authorization model, database schema (ERD), and functional requirements have been defined and documented. The PostgreSQL database schema (all 20 tables, 6 enums, foreign keys, and indexes) has been successfully implemented in the PostgreSQL database.

The immediate next implementation phase is **Phase 3 — Node.js Backend Foundation**.

---

## ✅ Completed

The following have been decided, designed, and documented / implemented:

### Product & Requirements
- [x] Product concept and problem statement
- [x] Target user definition (SMBs with large document collections)
- [x] Three core feature areas (Org management, Document management, AI assistant)
- [x] MVP success definition
- [x] Functional requirements (772 lines, full FR document)
- [x] Core system invariants documented
- [x] MVP constraints documented (what is out of scope)

### Architecture
- [x] High-level architecture decided (Frontend / Backend / AI Service / AI Worker separation)
- [x] Technology stack confirmed (Next.js, Node.js, Python/FastAPI, PostgreSQL, pgvector, RabbitMQ)
- [x] Component responsibility matrix defined
- [x] Deployment boundary defined (public vs. private application layer)
- [x] Architecture Mermaid diagram (in `docs/system-architecture.md`)
- [x] Architecture PNG diagram (`AI Powered Workspace Architecture Diagram.png`)
- [x] Document upload and processing flow (Mermaid sequence diagram)
- [x] RAG question-answer flow (Mermaid sequence diagram)
- [x] Security and multi-tenant isolation rules defined
- [x] Development setup: Docker Compose + MinIO + local Ollama
- [x] Production outline: Vercel + EC2/ECS/Render + RDS + AWS S3

### Authorization Model
- [x] Organization roles defined (OWNER, ADMIN, MEMBER)
- [x] Project roles defined (PROJECT_MANAGER, PROJECT_MEMBER)
- [x] Group-based permissions model designed
- [x] Document access modes designed (PROJECT, RESTRICTED)
- [x] Document access rule types designed (user, group, org role, project role)
- [x] DENY precedence rule confirmed
- [x] Authorization evaluation order defined (6-step pipeline)
- [x] ADMIN minimum count rule defined
- [x] Project Manager minimum count rule defined
- [x] Conversation authorization rules defined
- [x] Ownership transfer rules defined

### Database / Domain Model & PostgreSQL Schema Implementation
- [x] ERD created and exported (PNG + PDF in `/ERD/`)
- [x] All core entities defined with columns and types
- [x] PostgreSQL Enums created:
  - `organization_role` (OWNER, ADMIN, MEMBER)
  - `project_role` (PROJECT_MANAGER, PROJECT_MEMBER)
  - `document_access_mode` (PROJECT, RESTRICTED)
  - `document_effect` (ALLOW, DENY)
  - `document_version_status` (QUEUED, PROCESSING, READY, FAILED)
  - `message_role` (USER, ASSISTANT, SYSTEM)
- [x] All 20 tables created with columns, primary keys, and foreign keys:
  - `users`
  - `organizations`
  - `organization_memberships`
  - `invitations`
  - `projects`
  - `project_memberships`
  - `groups`
  - `group_memberships`
  - `documents`
  - `document_versions`
  - `document_chunks` (with embedding column for pgvector)
  - `document_user_access`
  - `document_group_access`
  - `document_org_role_access`
  - `document_project_role_access`
  - `conversations`
  - `conversation_projects`
  - `messages`
  - `message_sources`
  - `audit_logs`
- [x] Foreign key relationships defined with appropriate ON DELETE behavior
- [x] Unique constraints and composite constraints created
- [x] Indexes configured for scoping, performance, and uniqueness
- [x] Audit log design confirmed and table created (append-only, org-scoped)

### RAG Design
- [x] Async document processing pipeline designed
- [x] RabbitMQ job types defined (PROCESS_DOCUMENT, REPROCESS_DOCUMENT, DELETE_DOCUMENT_VECTORS)
- [x] RAG question-answer flow designed
- [x] Authorization-aware retrieval requirement confirmed
- [x] Document versioning in RAG decided
- [x] RAG provenance/source reference chain designed
- [x] Insufficient-information behavior defined

### Decision Log
- [x] 20 confirmed decisions documented in `docs/decision-log.md`

---

## 🔄 In Progress

Nothing currently in active implementation. Ready to initiate Phase 3 (Node.js Backend Foundation).

---

## ⏭️ Next — Immediate Implementation Phase

### Phase 3 — Node.js Backend Foundation

This is the next concrete implementation task.

**Scope:**

- [ ] Project setup (Node.js + Express.js / TypeScript)
- [ ] Environment configuration (`.env.example`, configuration module)
- [ ] Database connection & pool configuration (PostgreSQL client / ORM / query builder)
- [ ] Request validation middleware (Zod or similar)
- [ ] Centralized error handling middleware
- [ ] Structured logging (Pino / Winston)
- [ ] Sentry error monitoring integration
- [ ] Health check endpoint (`GET /health`)
- [ ] Base repository / data access layer setup

**Reference files for this phase:**
- `docs/architecture/architecture.md` — backend architecture and component matrix
- `docs/architecture/database.md` — full database schema and entity details
- `docs/decision-log.md` — technology and architectural decisions

---

## 🔮 Future Phases (Not Started)

The following phases are planned following backend foundation. Order may vary based on priorities:

### Phase 4 — Authentication
- User registration
- Email verification flow
- Login + JWT issuance
- Refresh token rotation
- Password reset flow
- Logout

### Phase 5 — Organization Management
- Create organization
- View organizations (user's memberships)
- Organization settings (OWNER only)
- Transfer ownership
- Delete organization

### Phase 6 — Member and Invitation Management
- Invite member (email + role)
- Prevent duplicate active invitations
- Accept / reject invitation flow
- Existing user invitation flow
- New user invitation flow
- Remove member (with ADMIN minimum count enforcement)
- Change member role (with OWNER protection)

### Phase 7 — Project Management
- Create project
- View projects (authorized)
- Project membership management
- PROJECT_MANAGER minimum count enforcement

### Phase 8 — Group Management
- Create group
- Add/remove group members
- View groups

### Phase 9 — Document Upload
- File validation (type, size)
- Duplicate detection (content hash)
- Object storage upload (MinIO/S3)
- Document record creation
- Document version record creation
- Job publication to RabbitMQ

### Phase 10 — Asynchronous Document Processing (AI Worker)
- RabbitMQ consumer setup
- Document download from object storage
- Content extraction (PDF, DOCX, XLSX, TXT, PPTX)
- Content normalization
- Chunking
- Status transitions (QUEUED → PROCESSING → READY / FAILED)
- Retry logic

### Phase 11 — Embedding Pipeline
- Embedding model integration (Ollama)
- Batch embedding generation
- Store embeddings in pgvector
- Vector index creation

### Phase 12 — RAG and Conversations
- Conversation creation
- Conversation project scope selection
- Question embedding
- Authorization-aware vector similarity search
- LLM integration (Ollama)
- Grounded answer generation
- Source/citation building
- Message + message_source storage

### Phase 13 — Document Access Control
- Document access mode management (PROJECT / RESTRICTED)
- Individual user access rules
- Group access rules
- Organization role access rules
- Project role access rules
- Authorization evaluation pipeline implementation

### Phase 14 — Python AI Service (FastAPI)
- FastAPI project setup
- Embedding service
- RAG service (similarity search + context building)
- LLM service
- Utility service (text extraction, chunking)
- Sentry integration

### Phase 15 — Next.js Frontend
- Project setup (Next.js + TypeScript)
- Tailwind CSS + Shadcn/ui
- Zustand + React Query state management
- Authentication pages
- Dashboard
- Organization management UI
- Document management UI
- AI chat interface
- Source reference display

### Phase 16 — Audit Logging
- Audit log writes for all major operations
- Audit log read API (for OWNER/ADMIN)

### Phase 17 — Deployment
- Docker Compose (full local dev stack)
- Dockerfile per service
- CI/CD pipeline (GitHub Actions)
- Production deployment (TBD provider)

### Phase 18 — Testing
- Unit tests (backend business logic)
- Integration tests (API endpoints)
- Authorization boundary tests
- Multi-tenant isolation tests
- RAG pipeline tests

### Phase 19 — Security Hardening
- Rate limiting
- Input validation hardening
- JWT security review
- Secrets management
- Security headers

### Phase 20 — Monitoring and Observability
- Structured logging (all services)
- Sentry performance monitoring
- Log aggregation (TBD — Logtail / ELK)
- Health check endpoints

---

## ⚠️ Conflicts / Decisions Required

See the [Conflicts section](#conflicts--decisions-required-detail) below.

---

## ❓ Missing Information / TODOs

| # | Item | Impact |
|---|------|--------|
| 1 | Exact embedding model name/version | AI Worker, AI Service |
| 2 | Exact LLM model name/version | AI Service |
| 3 | Production LLM provider (Ollama vs OpenAI vs Anthropic) | Architecture, cost |
| 4 | Exact email provider (Resend confirmed; see CONFLICT-001) | Email Module |
| 5 | Maximum allowed file size | Document upload validation |
| 6 | Exact JWT / session authentication strategy | Auth Module |
| 7 | Exact invitation expiration period | Invitation flow |
| 8 | Exact ADMIN permission matrix (what ADMIN can/cannot do per resource) | Authorization |
| 9 | Whether users can create unlimited organizations | Org creation endpoint |
| 10 | Exact project deletion strategy (hard delete / soft delete / archive) | Project management |
| 11 | Exact document deletion and retention strategy | Document management |
| 12 | Exact duplicate detection scope (org-wide vs. project-wide) | Document upload |
| 13 | Rate limiting rules | Security, infrastructure |
| 14 | AI answer evaluation metrics | RAG quality |
| 15 | Whether OAuth social login is in scope for MVP | Frontend, Auth |
| 16 | Log aggregation platform (Sentry only / Logtail / ELK) | Monitoring |
| 17 | Exact production deployment provider (EC2, ECS, or Render) | Deployment |
| 18 | Migration tooling choice (Flyway, Liquibase, raw SQL) | Database |
| 19 | Exact CI/CD provider | DevOps |
| 20 | Chunking strategy (chunk size, overlap) | AI Worker, RAG quality |
| 21 | Similarity threshold for "insufficient information" response | RAG orchestration |
| 22 | Whether historical document versions are searchable by default | RAG retrieval |
| 23 | Streaming vs. non-streaming LLM responses | AI Service, Frontend |
| 24 | Whether conversation history is included as LLM context | RAG orchestration |
| 25 | AWS S3 development configuration / bucket naming | Object storage |

---

## Conflicts / Decisions Required (Detail)

### CONFLICT-001 — Email Provider

**Location A:** `docs/system-architecture.md` (line 124)
```
Resend — Transactional Email
```

**Location B:** `AI Powered Workspace Architecture Diagram.png` (External Services section)
```
SendGrid / Mailgun
```

**Analysis:**
- The `system-architecture.md` text clearly names **Resend** as the email provider.
- The architecture PNG diagram shows **SendGrid / Mailgun** as alternatives.
- The diagram also shows a `Decision Log` entry (DEC-007) in this file where Resend is marked as "Confirmed" with a note about this conflict.
- The PNG may reflect an earlier or alternate design discussion, or it may have been created to show options rather than a confirmed choice.

**Current best guess:** Resend is the confirmed provider based on the text document.

**Decision required:** Confirm Resend as the email provider, or select SendGrid / Mailgun, or document a fallback strategy.

---

### CONFLICT-002 — Tailwind CSS vs. Vanilla CSS

**Location A:** `AI Powered Workspace Architecture Diagram.png` (Frontend section)
```
Tailwind CSS + Shadcn/ui
```

**Location B:** `docs/system-architecture.md` (Component Responsibility Matrix)
```
Frontend: Next.js + TypeScript (no CSS framework specified)
```

**Analysis:**
- The architecture diagram explicitly shows Tailwind CSS + Shadcn/ui.
- The system-architecture.md does not contradict this but does not mention it.
- This is not a conflict in the traditional sense — the diagram likely has more frontend detail.

**Current best guess:** Tailwind CSS + Shadcn/ui is the agreed frontend styling approach.

**Decision required:** Confirm Tailwind CSS + Shadcn/ui as the frontend styling stack.

---

### CONFLICT-003 — Document Versioning in MVP

**Location A:** `docs/functional-requirements.md` (FR-DOC-006, line 457)
```
Document versioning is outside the initial MVP scope.
```

**Location B:** `docs/functional-requirements.md` (FR-DOC-006, line 455-456)
```
For the MVP, modified documents may be treated as new documents.
```

**Location C:** Parts 11-13 of this task briefing (confirmed design decisions)
```
Documents support versions. Historical versions should be preserved.
RAG/source provenance should allow identifying which version supported an answer.
```

**Location D:** `docs/architecture/database.md` (this document) and ERD
```
document_versions table exists with version_number, is_current, etc.
document_chunks linked to document_version_id
```

**Analysis:**
- The functional requirements document explicitly says "Document versioning is outside the initial MVP scope."
- However, the ERD (which is the confirmed database design baseline) includes a full `document_versions` table.
- The confirmed design decisions (Parts 11-13) treat document versioning as a designed and confirmed feature.
- This appears to be a scope evolution: versioning was out of MVP scope in the functional requirements phase, but was later incorporated into the database design.

**Current interpretation:** The database design (ERD) is the more recent artifact, and document versioning is designed into the schema. Whether the versioning **feature** (user-facing upload of new versions) is MVP or not is unclear.

**Decision required:** Clarify whether document versioning (user-facing new version upload) is in or out of MVP, while noting that the database schema already supports it.
