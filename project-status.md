# Project Status

> **Last synchronized:** 2026-09-09  
> **Purpose:** Single source of truth for project phase, completed work, in-progress work, and planned work.

---

## Current Phase

**Phase: Phase 13 Completed → Ready for Phase 14 (Python AI Service / FastAPI)**

Phase 13 (Document Access Control) has been fully implemented in `apps/api/`, hardened with granular per-document access rules (`document_user_access`, `document_group_access`, `document_org_role_access`, `document_project_role_access`), the strict 6-step evaluation pipeline with **`DENY` precedence**, full REST endpoints for access mode and rule configuration, middleware enforcement on direct document access and downloads, and native SQL subquery filtering within `ragRepository.searchAuthorizedChunks` so unauthorized document chunks are never retrieved or supplied to the LLM (`FR-AI-002`, `FR-AI-007`).

The immediate next implementation phase is **Phase 14 — Python AI Service (FastAPI)**.


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

### Phase 3 — Node.js Backend Foundation
- [x] Project setup (Node.js + Express.js 5 / TypeScript / ESM `NodeNext`)
- [x] Environment configuration (`.env.example`, Zod-validated `src/config/env.ts`)
- [x] Database connection & pool configuration (`pg.Pool` in `src/db/pool.ts` with lifecycle logging and graceful shutdown)
- [x] Request validation middleware & normalization (Zod error handling in `error.middleware.ts`)
- [x] Centralized error handling middleware (`AppError` hierarchy, `errorHandler`, `notFoundHandler`)
- [x] Structured logging (Pino logger + `pino-http` request tracing with sensitive field redaction)
- [x] Sentry error monitoring integration (Sentry SDK v10 with Express error handler and operational 4xx filter)
- [x] Health check endpoint (`GET /health` & `GET /api/v1/health` with live PostgreSQL readiness probe)
- [x] Base repository / data access layer setup (Generic `BaseRepository<T>` with parameterized queries and `withTransaction`)

### Phase 4 — Authentication & User Management
- [x] User registration with email uniqueness enforcement (`POST /api/v1/auth/register`)
- [x] Password security via bcrypt with configurable salt rounds (FR-AUTH-003)
- [x] User login with timing-safe credential verification (FR-AUTH-006, FR-AUTH-007)
- [x] Access Token (JWT) issuance & verification with custom claims
- [x] Refresh token rotation and session management (`POST /api/v1/auth/refresh`)
- [x] Authentication middleware (`authenticateUser`) with Express Request module augmentation
- [x] Protected profile endpoint (`GET /api/v1/auth/me`)
- [x] Email verification flow with signed 24h tokens (`POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`)
- [x] Transactional email service integration (`src/modules/email/email.service.ts`)
- [x] Password reset flow with single-use fingerprint tokens (`POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`)
- [x] User logout endpoint (`POST /api/v1/auth/logout`) (FR-AUTH-009)

### Phase 5 — Organization Management
- [x] Organization entity, types, and `OrganizationRepository`
- [x] Organization membership repository (`OrganizationMembershipRepository`)
- [x] Create organization endpoint (`POST /api/v1/organizations` with atomic owner membership creation via `withTransaction`)
- [x] List user's organizations (`GET /api/v1/organizations`)
- [x] Get organization details (`GET /api/v1/organizations/:id` with tenant isolation check)
- [x] List organization members (`GET /api/v1/organizations/:id/members`)
- [x] Update organization settings (`PATCH /api/v1/organizations/:id` - OWNER/ADMIN only)
- [x] Transfer ownership flow with strict single-owner invariant checks (`POST /api/v1/organizations/:id/transfer-ownership`)
- [x] Delete organization endpoint (`DELETE /api/v1/organizations/:id` - OWNER only)
- [x] Tenant context & role authorization middleware (`requireOrgMembership`, `requireOrgRole`)

### Phase 6 — Member and Invitation Management
- [x] Invitation entity, types, and `InvitationRepository` with lifecycle tracking (`PENDING`, `ACCEPTED`, `REJECTED`, `REVOKED`)
- [x] Invite member endpoint (`POST /api/v1/organizations/:id/invitations` with role assignment and token generation)
- [x] Prevent duplicate active invitations rule (FR-MEMBER-004)
- [x] List organization invitations (`GET /api/v1/organizations/:id/invitations`)
- [x] Revoke invitation endpoint (`DELETE /api/v1/organizations/:id/invitations/:invitationId`)
- [x] Accept invitation flow (`POST /api/v1/invitations/accept` for authenticated users and new users)
- [x] Reject invitation flow (`POST /api/v1/invitations/reject`)
- [x] Remove member endpoint with ADMIN minimum count enforcement (`DELETE /api/v1/organizations/:id/members/:userId`)
- [x] Update member role endpoint with OWNER protection (`PATCH /api/v1/organizations/:id/members/:userId/role`)
- [x] Invitation transactional email dispatch via `EmailService`
- [x] Database migration applied for `status` column and lookup indexes

### Phase 7 — Project Management
- [x] Project entity, types, and `ProjectRepository`
- [x] Project membership repository (`ProjectMembershipRepository`)
- [x] Create project endpoint (`POST /api/v1/organizations/:id/projects` with atomic initial `PROJECT_MANAGER` assignment)
- [x] List authorized projects (`GET /api/v1/organizations/:id/projects`) with strict member-level isolation
- [x] Get project details with access control (`GET /api/v1/projects/:id`)
- [x] Update project settings (`PATCH /api/v1/projects/:id`)
- [x] Delete project endpoint (`DELETE /api/v1/projects/:id`) with cascade
- [x] Add member to project (`POST /api/v1/projects/:id/members`) with cross-tenant membership validation
- [x] Update project member role (`PATCH /api/v1/projects/:id/members/:userId/role`) with `PROJECT_MANAGER` minimum count enforcement
- [x] Remove member from project (`DELETE /api/v1/projects/:id/members/:userId`) with `PROJECT_MANAGER` minimum count enforcement and self-removal support

### Phase 8 — Group Management
- [x] Group entity, types, and `GroupRepository`
- [x] Group membership repository (`GroupMembershipRepository`)
- [x] Create group endpoint (`POST /api/v1/organizations/:id/groups`) with OWNER/ADMIN role gate & duplicate name check
- [x] List organization groups (`GET /api/v1/organizations/:id/groups`) with member counts
- [x] Get group details (`GET /api/v1/groups/:id`) with caller membership flag
- [x] Update group settings (`PATCH /api/v1/groups/:id`) with rename conflict prevention
- [x] Delete group endpoint (`DELETE /api/v1/groups/:id`) with clean cascade of memberships
- [x] Add member to group (`POST /api/v1/groups/:id/members`) with strict cross-tenant validation & duplicate prevention
- [x] Remove member from group (`DELETE /api/v1/groups/:id/members/:userId`) with OWNER/ADMIN role check and self-removal support
- [x] List group members (`GET /api/v1/groups/:id/members`) with user details and org roles
- [x] Custom middleware `requireGroupAccess` & `requireGroupAdmin`

---

### Phase 9 — Document Upload
- [x] Storage service (`StorageService`) using `@aws-sdk/client-s3` compatible with local MinIO and AWS S3
- [x] Automatic bucket creation and lifecycle verification (`ai-workspace-documents`)
- [x] Document entity, types, and `DocumentRepository`
- [x] Document version repository (`DocumentVersionRepository`)
- [x] File validation middleware (`handleDocumentUpload`) enforcing supported formats (PDF, DOCX, XLSX, TXT, PPTX) and 50MB size limit
- [x] Content deduplication using SHA-256 hash per project scope (`FR-DOC-005`)
- [x] Upload document endpoint (`POST /api/v1/projects/:id/documents` with multipart/form-data)
- [x] List project documents endpoint (`GET /api/v1/projects/:id/documents`)
- [x] Get document details endpoint (`GET /api/v1/documents/:id`)
- [x] Download document endpoint (`GET /api/v1/documents/:id/download` supporting both direct streaming and presigned URLs)
- [x] Update document metadata endpoint (`PATCH /api/v1/documents/:id`)
- [x] Delete document endpoint (`DELETE /api/v1/documents/:id` with database cascade and object storage cleanup)
- [x] Queue service abstraction (`QueueService`) publishing `PROCESS_DOCUMENT` job

---

### Phase 10 — Asynchronous Document Processing (AI Worker) ✅ COMPLETE (2026-09-09)
- [x] Python worker service (`apps/worker`) configured with virtual environment, strict typing, and clean dependencies.
- [x] RabbitMQ consumer with Dead Letter Queue (`document-processing`, `document-processing-dlx`, `document-processing-dlq`) and 300s heartbeat.
- [x] S3 / MinIO storage downloader (`StorageClient`) supporting path-style addressing, unified `S3_ENDPOINT` / `S3_ENDPOINT_URL` alias, and OOM defense (50MB cap).
- [x] Format extractors aligned with API (PDF, DOCX, XLSX, PPTX, TXT) with explicit rejection of unsupported legacy formats (`.doc`, `.ppt`, `.xls`).
- [x] Extractor resource safety: `openpyxl` workbook closure guaranteed via `try...finally: wb.close()`, and `file_stream.seek(0)` across all extractors.
- [x] Text normalizer (`TextNormalizer`) with NFKC unicode normalization, null-byte stripping, and whitespace sanitization.
- [x] Semantic sliding-window chunker (`DocumentChunker`) with configurable size (1000 chars), overlap (200 chars), and word-boundary snapping.
- [x] Database persistence (`db.py`) inserting chunks idempotently into `document_chunks` using `execute_values`.
- [x] Thread-safe database pooling using `psycopg2.pool.ThreadedConnectionPool` (bounds 2 to 10) with graceful shutdown cleanup (`close_connection_pool`).
- [x] Status state machine (`QUEUED` → `PROCESSING` → `READY` / `FAILED` with synchronized `processed_at = NOW()`).
- [x] Full test verification: 34 unit & integration scenarios verified.

### Phase 11 — Embedding Pipeline (Ollama / pgvector) ✅ COMPLETE (2026-09-11)
- [x] Official Python pgvector adapter integrated into connection pooling (`apps/worker/src/db.py`).
- [x] Schema migration to constrained `vector(768)` matching `nomic-embed-text` with HNSW cosine distance index (`document_chunks_embedding_hnsw_idx` with `m=16, ef_construction=64`).
- [x] Pluggable embedding client architecture (`BaseEmbeddingClient` with L2 unit normalization, text sanitization, null byte removal, and defensive 8,000-char capping).
- [x] `OllamaEmbeddingClient` with batch `/api/embed` support, legacy `/api/embeddings` fallback, dimension validation, and exponential backoff retry with jitter.
- [x] `MockEmbeddingClient` producing deterministic, reproducible 768-dim L2-normalized vectors for test suites and offline environments.
- [x] End-to-end integration into `DocumentProcessor.process_version` generating vector embeddings in configurable batches (`EMBEDDING_BATCH_SIZE=32`) and atomically persisting chunks with embeddings.
- [x] Standalone batch backfill CLI tool (`batch_embedder.py`) with concurrency-safe row locking (`FOR UPDATE SKIP LOCKED`).
- [x] 12 automated unit and integration tests passing with 100% success rate across client, pgvector, and processor pipelines.

### Phase 12 — RAG and Conversations ✅ COMPLETE (2026-09-11)
- [x] Conversation and message domain model, TypeScript entities, and Zod validation schemas (`apps/api/src/modules/conversations/`).
- [x] Conversation repository with atomic `conversation_projects` project scope association and lifecycle tracking.
- [x] Message repository with chronological thread retrieval and enriched citation lookup.
- [x] Authorization-aware RAG vector search (`RagRepository`) with multi-tenant isolation, project boundaries, and document readiness filtering (`v.status = 'READY' AND v.is_current = true`).
- [x] Pluggable `AiClient` interface with `OllamaAiClient` (`nomic-embed-text` + `qwen2.5`) and deterministic `MockAiClient` for test suites.
- [x] Grounded prompt assembly with XML document isolation and prompt injection defense.
- [x] `FR-AI-005` insufficient information fallback when no chunks match or similarity falls below threshold.
- [x] Atomic persistence of assistant responses and citation provenance (`message_sources` with rank and similarity scores) inside single database transactions.
- [x] REST controllers, conversation middleware (`requireConversationAccess`), and routes mounted in Express application.
- [x] 100% test pass rate across conversation CRUD, cross-tenant isolation, project scope filtering, grounded RAG answering, and insufficient information fallback.

---

### Phase 13 — Document Access Control ✅ COMPLETE (2026-09-11)
- [x] Document access mode management (`PROJECT` vs. `RESTRICTED`) via `PATCH /api/v1/documents/:id/access-mode`.
- [x] Individual user access rules (`document_user_access` with `ALLOW` / `DENY`) via `POST` & `DELETE /api/v1/documents/:id/access-rules/users`.
- [x] Group access rules (`document_group_access` with `ALLOW` / `DENY`) via `POST` & `DELETE /api/v1/documents/:id/access-rules/groups`.
- [x] Organization role access rules (`document_org_role_access`) via `POST` & `DELETE /api/v1/documents/:id/access-rules/org-roles`.
- [x] Project role access rules (`document_project_role_access`) via `POST` & `DELETE /api/v1/documents/:id/access-rules/project-roles`.
- [x] Aggregated document access summary endpoint (`GET /api/v1/documents/:id/access-rules`).
- [x] Strict 6-step evaluation pipeline with `DENY` precedence (`DocumentAccessRepository.evaluateUserAccess` & `DocumentAccessService.evaluateAccess`).
- [x] Middleware enforcement: `requireDocumentAccess` executes 6-step evaluation pipeline for `RESTRICTED` documents; `requireDocumentManageAccess` prevents management deadlocks.
- [x] Cross-tenant validation: Prevents assigning access rules for users or groups belonging to a different organization.
- [x] Project document listing filtering: `listByProject` filters out unauthorized restricted documents for regular members.
- [x] Database-level RAG vector search filtering: Subquery in `ragRepository.searchAuthorizedChunks` enforces access mode, user rules, group memberships, and role assignments with `DENY` precedence directly during vector similarity searches (`FR-AI-002`, `FR-AI-007`).
- [x] 100% test pass rate across 9 automated integration test scenarios with clean teardown.

---

## 🔄 In Progress

Nothing currently in active implementation. Phase 13 completed. Ready to initiate Phase 14 (Python AI Service / FastAPI).

---

## ⏭️ Next — Immediate Implementation Phase

### Phase 14 — Python AI Service (FastAPI)

This is the next concrete implementation task.

**Scope:**
- [ ] FastAPI project setup (`apps/ai-service`) with poetry / pip requirements
- [ ] Embedding service with unified `/embeddings` endpoint
- [ ] RAG service with similarity search, context building, and XML prompt assembly
- [ ] LLM chat service with streaming and non-streaming response generation
- [ ] Text extraction and semantic chunking utility endpoints
- [ ] Sentry error monitoring and structured logging integration

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

| # | Item | Status | Impact / Implementation Resolution |
|---|------|--------|-----------------------------------|
| 1 | Exact embedding model name/version | ⏳ Pending | AI Worker, AI Service (Phase 11) |
| 2 | Exact LLM model name/version | ⏳ Pending | AI Service (Phase 12) |
| 3 | Production LLM provider (Ollama vs OpenAI vs Anthropic) | ⏳ Pending | Architecture, cost (Phase 14) |
| 4 | Exact email provider | ✅ **Resolved** | **Resend** confirmed & implemented (`apps/api/src/modules/email/email.service.ts`) |
| 5 | Maximum allowed file size | ✅ **Resolved** | **50MB** (`52,428,800` bytes) enforced in `env.ts` and `upload.middleware.ts` |
| 6 | Exact JWT / session authentication strategy | ✅ **Resolved** | **Dual-token**: 15m Access Token + 7d Refresh Token with rotation in `auth.service.ts` |
| 7 | Exact invitation expiration period | ✅ **Resolved** | **7 days** cryptographically signed invitation tokens in `invitation.service.ts` |
| 8 | Exact ADMIN permission matrix | ✅ **Resolved** | ADMIN manages memberships, invitations, and groups; cannot delete org or transfer ownership (OWNER only) |
| 9 | Whether users can create unlimited organizations | ✅ **Resolved** | **Unlimited**: any authenticated user can create an organization; creator becomes initial OWNER |
| 10 | Exact project deletion strategy | ✅ **Resolved** | **Hard delete with cascade**: PostgreSQL `ON DELETE CASCADE` purges project memberships, documents, chunks |
| 11 | Exact document deletion and retention strategy | ✅ **Resolved** | **Hard delete + Storage purge**: DB cascade deletes versions; MinIO/S3 objects are deleted via `StorageService` |
| 12 | Exact duplicate detection scope | ✅ **Resolved** | **Project-scoped SHA-256**: duplicate content in same project rejected (`409 Conflict`, `FR-DOC-005`) |
| 13 | Rate limiting rules | ⏳ Pending | Security, infrastructure (pre-production hardening) |
| 14 | AI answer evaluation metrics | ⏳ Pending | RAG quality (Phase 12) |
| 15 | Whether OAuth social login is in scope for MVP | ⏳ Pending | Frontend, Auth (post-MVP extension) |
| 16 | Log aggregation platform (Sentry only / Logtail / ELK) | ⏳ Pending | Monitoring (Pino HTTP + Sentry active; external aggregator deferred) |
| 17 | Exact production deployment provider (EC2, ECS, or Render) | ⏳ Pending | Deployment (DevOps phase) |
| 18 | Migration tooling choice (Flyway, Liquibase, raw SQL) | ⏳ Pending | Database (raw PostgreSQL baseline currently verified) |
| 19 | Exact CI/CD provider | ⏳ Pending | DevOps (GitHub Actions / GitLab CI) |
| 20 | Chunking strategy (chunk size, overlap) | ✅ **Resolved** | 1000 characters chunk size, 200 characters overlap with paragraph, sentence, and word boundary snapping (`apps/worker/src/chunker.py`) |

| 21 | Similarity threshold for "insufficient information" response | ⏳ Pending | RAG orchestration (Phase 12) |
| 22 | Whether historical document versions are searchable by default | ⏳ Pending | RAG retrieval (Phase 12) |
| 23 | Streaming vs. non-streaming LLM responses | ⏳ Pending | AI Service, Frontend (Phase 12) |
| 24 | Whether conversation history is included as LLM context | ⏳ Pending | RAG orchestration (Phase 12) |
| 25 | AWS S3 development configuration / bucket naming | ✅ **Resolved** | Local MinIO (`http://localhost:9000`), bucket `ai-workspace-documents`, `@aws-sdk/client-s3` |

---

## Conflicts / Decisions Required (Detail)

### CONFLICT-001 — Email Provider (RESOLVED)

- **Status:** **Resolved — Resend Confirmed & Implemented**
- **Location A:** `docs/system-architecture.md` (line 124) → Resend
- **Location B:** `AI Powered Workspace Architecture Diagram.png` → SendGrid / Mailgun alternatives
- **Resolution:**
  Resend is the confirmed transactional email provider for all authentication, invitation, and notification flows. The email module is implemented in `apps/api/src/modules/email/email.service.ts` using the Resend SDK, supporting verification emails, password resets, and organization invites.

---

### CONFLICT-002 — Tailwind CSS vs. Vanilla CSS (PENDING - FRONTEND)

- **Status:** **Pending (Deferred to Frontend Implementation)**
- **Location A:** `AI Powered Workspace Architecture Diagram.png` → Tailwind CSS + Shadcn/ui
- **Location B:** `docs/system-architecture.md` → Next.js + TypeScript
- **Analysis:** This is a frontend presentation concern and will be finalized when initiating the Next.js frontend application.

---

### CONFLICT-003 — Document Versioning in MVP (RESOLVED)

- **Status:** **Resolved — Versioning Baseline Implemented**
- **Location A:** `docs/functional-requirements.md` (FR-DOC-006) → "Document versioning is outside initial MVP scope"
- **Location B:** `docs/architecture/database.md` & ERD → `document_versions` table exists with status and content hash
- **Resolution:**
  The schema and backend implementation in Phase 9 reconcile this distinction:
  1. Every document upload creates a `document_versions` row with `version_number: 1`, `is_current: true`, status `QUEUED`, and SHA-256 hash.
  2. Modified content with an existing filename is accepted as a new document record per `FR-DOC-006`.
  3. The underlying database schema and `document_versions` structure preserve the capability for multi-version document histories and RAG version provenance.

