# Project Status

> **Last synchronized:** 2026-10-08 (post-launch stabilization)  
> **Purpose:** Single source of truth for project phase, completed work, in-progress work, and planned work.

---

## Current Phase

**All Project Phases (Phases 1 through 17) Completed — Live in Production**

**OAuth social login and Sentry production monitoring will be implemented in the future.**

All foundational, core business, AI processing, frontend, audit, platform governance, and deployment features (Phases 1 through 17 + Platform Admin) are fully implemented, verified, and live:
- **Phase 11 (Embedding Pipeline)**: pgvector `vector(768)` HNSW cosine index, Gemini (`gemini-embedding-001`) and Ollama (`nomic-embed-text`) clients, batch embedding in worker.
- **Phase 12 (RAG & Conversations)**: Multi-turn conversations, XML prompt isolation, grounded answer generation, insufficient-information fallback, and source citations.
- **Phase 13 (Document Access Control)**: Granular access control (`PROJECT` vs `RESTRICTED`), 6-step evaluation pipeline with strict `DENY` precedence, database-level subquery filtering during vector search.
- **Phase 14 (Python AI Service)**: FastAPI microservice with asyncpg connection pooling, synchronous `/rag/query`, Server-Sent Events `/rag/stream`, and Gemini/Ollama provider abstraction.
- **Phase 15 (Next.js Frontend)**: Next.js 16 App Router, dark-mode design system with Tailwind CSS v4, complete auth suite, organization & project management, drag-and-drop file upload with status polling, granular access rule dialog, and interactive citation drawer.
- **Phase 16 (Audit Logging)**: Append-only PostgreSQL audit log, non-fatal event dispatch across all entity mutations, protected endpoints for OWNER/ADMIN, and frontend audit log inspector.
- **Platform Owner Administration & Tenant Governance (Completed)**:
  - **Zero-Knowledge Privacy Boundary**: Dedicated platform owner dashboard (`/admin`) displaying aggregated tenant telemetry (org name, owner contact, creation date, member/project/document counts, storage used) with zero exposure of tenant documents, file contents, vectors, or chat histories.
  - **Organization Suspension & Reversible Lockout**: Immediate universal member lockout via database-level chokepoint (`organizations.status = 'ACTIVE'`) preserving 100% of tenant data while denying all workspace access.
  - **Air-Gapped Admin Management**: Privileged platform admin roles (`users.is_platform_admin`) managed exclusively via CLI (`npm run platform-admin -- grant/revoke <email>`), preventing HTTP privilege escalation.
- **Phase 17 (Production Deployment, Dockerization & CI/CD) (Completed)**:
  - **Production Dockerization**: Multi-stage, security-hardened Dockerfiles for `apps/api` (Node.js 22 slim), `apps/ai-service` (Python 3.11 slim), and `apps/worker` (Python 3.11 slim) running under non-privileged users with `.dockerignore` filters.
  - **Docker Compose Orchestration**: Unified `docker-compose.yml` tying API, AI Service, and Background Worker on an internal bridge network (`workspace-network`) with 250MB memory limits per container.
  - **AWS EC2 Free Tier (`t3.micro`) Optimization**: Configured 4.0 GiB swap memory on AWS EBS gp3 volume, preventing Out-Of-Memory (OOM) issues on 1GB RAM instances.
  - **Automated HTTPS & SSL**: Zero-touch reverse proxying via **Caddy Server** and `sslip.io` (`https://3-25-255-191.sslip.io`), auto-provisioning Let's Encrypt certificates.
  - **Frontend Live on Vercel**: Next.js 16 frontend deployed globally on Vercel Edge CDN with production API routing and dynamic CORS support.
  - **Automated CI/CD Pipelines**: Automated GitHub Actions workflow (`.github/workflows/deploy-backend.yml`) for zero-downtime EC2 backend redeployment, image pruning, and health verification; continuous Git deployment on Vercel for frontend.
- **Post-Phase 16 Hardening & UX Polish (Completed)**:
  - **API Rate Limiting & Security (`apps/api`)**: In-memory IP-based rate limiting on sensitive auth endpoints (`/login`, `/register`, etc.) and internal service token (`AI_SERVICE_TOKEN`) protection for the Python AI service.
  - **Frontend UI/UX Refinement (`apps/web`)**: Interactive Help Center (`/help`), User Account Settings (`/settings/account`), Invitation Acceptance page (`/invitations/accept`), "Your Access" permission cards, Email Verification banner, empty organization guards, accessible confirm dialogs & custom select inputs, and client-side response normalization.
  - **Service Resilience (`apps/worker`, `apps/api`, `apps/ai-service`)**: Reconnect resilience for RabbitMQ, S3/MinIO error handling, Neon Serverless Postgres support with pgvector, and Gemini provider as cost-effective default.
- **Multimodal AI Vision & Image RAG Pipeline (Completed)**:
  - **Multimodal AI Vision OCR**: Implemented `ImageExtractor` in `apps/worker` using Google Gemini Vision (`gemini-3.6-flash` with automatic fallback sequence across `gemini-3-flash-preview`, `gemini-flash-lite-latest`, and `gemini-3.1-flash-lite`).
  - **Broad Image Format Whitelist**: End-to-end ingestion and extraction for raster formats (`.png`, `.jpg`, `.jpeg`, `.jfif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.gif`) with in-memory Pillow format normalization.
  - **Diagram & Workflow Transcription**: Transcribes complex visual architectures, flowcharts, tables, and infographics into clean GitHub-flavored Markdown for semantic chunking and vector storage.
  - **Image Citation & UI Grounding**: Frontend chat displays dedicated violet `ImageIcon` pills, "Image OCR" badges, and relevance metrics in the source citation drawer. The upload zone provides instant thumbnail previews.



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
- [x] Development setup: Docker Compose + MinIO (local S3 emulator for dev only) + local Ollama (local dev only)
- [x] Production outline: Vercel / Cloud Container + AWS S3 + Google Gemini API + Neon Serverless PostgreSQL

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
- [x] 35 confirmed decisions documented in `docs/decision-log.md`

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
- [x] Pre-registration email verification: `POST /api/v1/auth/register/initiate` emails a signed, single-use 24h link (stored hashed in `email_verifications`, migration `003`); `POST /api/v1/auth/register` consumes it, creates the already-verified user, and returns tokens (automatic sign-in)
- [x] Email verification endpoints (`POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`)
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
- [x] Accept invitation flow (`POST /api/v1/invitations/accept` for authenticated users)
- [x] One-step accept-and-register for new users (`POST /api/v1/invitations/accept-and-register`, `GET|POST /api/v1/invitations/details`) with automatic sign-in
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

### Phase 14 — Python AI Service (FastAPI) ✅ COMPLETE (2026-09-11)
- [x] FastAPI project setup (`apps/ai-service`) with virtual environment and production dependencies.
- [x] Pydantic Settings configuration (`src/config.py`) and structured logging (`src/logger.py`).
- [x] Async PostgreSQL connection pooling (`asyncpg`) with vector registration (`pgvector.asyncpg.register_vector`).
- [x] Embedding service with single (`POST /api/v1/embeddings`) and batch (`POST /api/v1/embeddings/batch`) 768-dim normalized vectors.
- [x] Synchronous RAG endpoint (`POST /api/v1/rag/query`) with pgvector search, XML prompt isolation, grounded answer generation, and structured source citations.
- [x] Streaming RAG endpoint (`POST /api/v1/rag/stream`) with Server-Sent Events (`text/event-stream`), real-time token streaming, and final citation payload.
- [x] `FR-AI-005` insufficient information fallback handling when similarity is below threshold or zero chunks match.
- [x] Full database-level Phase 13 document access control enforcement with 6-step evaluation and `DENY` precedence.
- [x] LLM completion endpoint (`POST /api/v1/llm/chat`) and semantic chunking endpoint (`POST /api/v1/utils/chunk`).
- [x] Gemini embedding client in `apps/worker` (`EMBEDDING_PROVIDER=gemini`) and `apps/api` routed through ai-service (`AI_PROVIDER=ai-service`), so ingestion and query embeddings share one model.
- [x] Pluggable AI provider architecture (Gemini API, Ollama `nomic-embed-text` + `qwen2.5`, and deterministic `MockProvider`; selected via `AI_PROVIDER`).
- [x] Node.js backend client (`FastApiAiServiceClient`) integrated into `apps/api`.
- [x] 100% automated test verification across all 6 core functionality areas.

---
 
 ### Phase 15 — Next.js Frontend ✅ COMPLETE (2026-09-11)
 - [x] Modern Next.js 16+ (App Router) project initialized in `apps/web` with TypeScript and Tailwind CSS v4.
 - [x] Curated dark mode design system with glassmorphism, glowing micro-accents, and custom scrollbars (`src/app/globals.css`).
 - [x] Complete authentication suite:
   - Login with session redirection and session expiration handling (`/login`).
   - Register with password confirmation and verification notification (`/register`).
   - Email verification with query param auto-trigger and resend capability (`/verify-email`).
   - Self-service forgot password and reset password flows (`/forgot-password`, `/reset-password`).
 - [x] Robust HTTP client with automatic 401 refresh token mutex queue (`src/lib/api-client.ts`).
 - [x] Zustand state management with strict multi-tenant isolation (`auth.store.ts` & `org.store.ts`).
 - [x] Application Shell & Context Switching:
   - Sticky navbar with active organization switcher dropdown (`OrgSwitcher`) and new org creation modal.
   - User profile dropdown with initials avatar and clean sign out (`UserMenu`).
   - Collapsible sidebar with active tenant indicator and role-based links.
 - [x] Organization Administration:
   - Organization settings with rename, ownership transfer dialog, and org deletion modal (`/settings/organization`).
   - Member management with directory table, role changes (`ADMIN`/`MEMBER`), member removal, and invite dialog (`/settings/members`).
   - Invitation tracking with live statuses (`PENDING`, `ACCEPTED`, `REVOKED`) and revoke triggers (`/settings/invitations`).
   - Group management with member counts, creation modal, and group member management dialog (`/settings/groups`).
 - [x] Project Hub & Document Management:
   - Project directory with manager badges and project creation modal (`/projects`).
   - Project details view with document hub and member roster (`/projects/[projectId]`).
   - Drag-and-drop file upload zone with client-side 50MB and extension validation, plus 409 conflict handling (`DocumentUploadZone`).
   - Document listing table with real-time status badges (`QUEUED`, `PROCESSING`, `READY`, `FAILED`), download links, and delete modals.
   - Automatic 3-second status polling while documents are in `QUEUED` or `PROCESSING` state.
   - Granular Document Access Control Dialog (`AccessRulesDialog`) supporting Phase 13 6-step evaluation with `PROJECT` vs `RESTRICTED` mode, `ALLOW`/`DENY` user rules, group rules, org role rules, and project role rules with explicit `DENY` precedence.
 - [x] AI Assistant Conversational Interface:
   - Thread list sidebar with new chat, rename, and delete actions.
   - Project scope selector ("All Accessible Projects" vs individual project scope).
   - Chat message bubbles with rich markdown rendering (`react-markdown` + `remark-gfm`).
   - `FR-AI-005` Insufficient Information warning callout when documents do not contain evidence.
   - Clickable source citation pills `[1]`, `[2]` with cosine similarity confidence percentages.
   - Interactive off-canvas Source Citation Drawer (`SourceCitationDrawer`) displaying document title, chunk index, page number, confidence meter, and exact grounded chunk text excerpt (`FR-AI-006`).
 - [x] Production build validation: `npm run build` generates all 15 static/dynamic routes with zero TypeScript or Turbopack errors.

### Phase 16 — Audit Logging (Completed)
- [x] Immutable PostgreSQL append-only data layer (`apps/api/src/modules/audit/audit.repository.ts`)
- [x] Non-fatal, transaction-safe audit recording service (`apps/api/src/modules/audit/audit.service.ts`)
- [x] Instrument all major system mutations:
  - Organization create, update, ownership transfer, delete
  - Member invite, join, remove, role update, invitation revoke
  - Project create, update, delete, member add/update/remove
  - Group create, update, delete, member add/remove
  - Document upload, update, delete, granular access rule mutations
- [x] Protected audit log read endpoints (`GET /api/v1/organizations/:id/audit-logs`, `/filters`) restricted to OWNER and ADMIN
- [x] Frontend Audit Log viewer page (`apps/web/src/app/(dashboard)/settings/audit-logs/page.tsx`) with search, filter dropdowns, pagination, and JSON inspector modal

---

### Post-Phase 16 — Hardening, UI/UX Polish & Cloud Readiness ✅ COMPLETE (2026-10-06)
- [x] **Gemini API Integration (Primary AI Provider)**:
  - Configured `gemini-3.6-flash` for high-throughput, low-latency generation and streaming.
  - Configured `gemini-embedding-001` with 768 output dimensions matching pgvector HNSW schema.
  - Seamless toggle between Gemini, local Ollama (`qwen2.5` + `nomic-embed-text`), and deterministic Mock providers via `AI_PROVIDER` / `EMBEDDING_PROVIDER`.
- [x] **Neon Serverless PostgreSQL Support**:
  - Connection pooling via PgBouncer pooled connection strings.
  - Direct connection support for vector migrations and vector registration.
- [x] **API Rate Limiting & Microservice Security**:
  - In-memory fixed-window IP rate limiter (`apps/api/src/middlewares/rate-limit.middleware.ts`) guarding `/login`, `/register`, and verification endpoints.
  - Internal service authentication token (`AI_SERVICE_TOKEN`) guarding Python FastAPI endpoints from unauthorized intranet calls.
- [x] **Frontend UI/UX Enhancements (`apps/web`)**:
  - Interactive Help Center (`/help`) with guides for RAG search, access control, roles, and FAQs.
  - User Account Settings (`/settings/account`) with profile information and credential management.
  - Seamless Invitation Acceptance flow (`/invitations/accept`) with deep linking and auth redirection.
  - Contextual "Your Access" permission card (`YourAccessCard`) displaying user privileges.
  - Email verification reminder banner (`VerificationBanner`) with one-click resend.
  - Empty organization fallback view (`NoOrganization`) guiding initial setup.
  - Custom themed accessible dialogs and dropdowns (`ConfirmDialog`, `Modal`, `Select`).
  - Client-side payload unwrapping, normalization, and error handling (`api-client.ts`, `normalize.ts`, `permissions.ts`).
- [x] **Platform Owner Administration & Tenant Governance**:
  - Schema migrations: `apps/api/migrations/001_platform_admin.sql` (adds `users.is_platform_admin`, `organizations.status` `['ACTIVE', 'SUSPENDED']`, `suspended_at`, `suspended_by`, `suspension_reason`) and `002_allow_audit_log_purge_on_org_delete.sql` (enables authorized cascade purge of audit logs during organization deletion).
  - Secure CLI utility: `npm run platform-admin -- [migrate|grant|revoke|list]` in `apps/api/src/scripts/platform-admin.ts`.
  - Zero-knowledge data access layer: `PlatformAdminRepository` calculates aggregate statistics (total organizations, active/suspended count, storage used, members, projects, documents) without querying content or chunk tables.
  - Universal member lockout chokepoint: `OrganizationMembershipRepository.findByUserAndOrg` strictly joins on `o.status = 'ACTIVE'`, blocking all members of suspended organizations from all document, project, group, and chat services.
  - Organization middleware guard: `organization.middleware.ts` returns `403 Forbidden` (`ORGANIZATION_SUSPENDED`) when an org is suspended.
  - Automated owner email notifications: Dispatches formal emails to the primary owner on suspension (including reason) and on permanent deletion via `EmailService.sendOrganizationSuspendedEmail` and `sendOrganizationDeletedEmail`.
  - Permanent deletion & 100% data purge: Platform admin endpoint `DELETE /api/v1/admin/organizations/:id` purges all database records (cascade down to chunks, vectors, projects, chats) and permanently removes all stored files from object storage (MinIO / S3).
  - Invitation guard: `invitation.service.ts` rejects invitation acceptances for suspended organizations.
  - Platform admin middleware: `platform-admin.middleware.ts` verifies `user.is_platform_admin === true`.
  - Audit logging integration: Emits `organization.suspended` and `organization.reactivated` events into `audit_logs`.
  - Frontend admin dashboard: Dedicated `/admin` route in `apps/web` with KPI metric cards, organization search & status filter, suspension reason modal, reactivation confirmation dialog, permanent deletion confirmation modal with double-confirmation name matching, and tenant privacy guarantee notice.
  - Frontend layout indicators: Navigation item in sidebar, badge and menu button in user profile dropdown, `Suspended` badge in org switcher, and informational banner in workspace layout.

- [x] **Service & Queue Resilience**:
  - Exponential backoff reconnect and recovery for RabbitMQ consumers and publishers.
  - Graceful connection pool teardown on SIGTERM/SIGINT across Node.js and FastAPI services.
  - S3 / MinIO storage error handling and unified streaming.

---

### Post-Launch Updates (2026-10-08)
- [x] **Pre-registration email verification and auto-login** (DEC-034): new `email_verifications` table (`apps/api/migrations/003_email_verifications.sql`), new `/register`, `/verify-email` and `/invitations/accept` flows in `apps/web`, 11 automated auth tests (`npm test` in `apps/api`).
- [x] **Worker job pickup** (DEC-035): the database poller no longer pre-claims versions, which had left every polled document stuck in `PROCESSING`; suspended organizations are skipped; the worker tolerates a database without the pgvector extension at first start.
- [x] **Web fixes**: document sizes display correctly (Postgres `bigint` arrives as a string); post-login redirects reject control characters.
- [x] **API fixes**: raw invitation token no longer returned to the inviter; invitation rejection only applies to pending invitations; email-verification tokens carry a unique `jti`; `trust proxy` enabled in production so rate limits apply per client; `.env.example` pool defaults corrected.
- [x] **Ops**: AI service Docker healthcheck timeout raised to 12s so a slow database ping no longer blocks API startup.

### Known Issues / Backlog (from the 2026-10-08 audit, not yet changed)
- **AI service token**: `AI_SERVICE_TOKEN` unset disables the internal auth check (documented dev behaviour); consider failing startup when `ENVIRONMENT=production`.
- **Worker resilience**: a document can stay `PROCESSING` if the worker is killed mid-job (only the API's 20-minute sweep recovers it); failed image OCR still yields a `READY` placeholder document.
- **Authorization edge cases**: org OWNER/ADMIN can read member conversation titles (conflicts with `authorization.md` §8); a `PROJECT_MANAGER` can manage rules on a document they are denied; ownership transfer and last-admin checks are not row-locked.
- **Auth/email**: SMTP/Resend failures are swallowed, so the UI may report an email as sent; legacy users with `email_verified_at IS NULL` cannot complete the new verification flow.
- **Deployment config**: `docker-compose.yml` `FRONTEND_URL` / `CORS_ORIGIN` override `.env.production`; `.env.production.example` uses `API_PREFIX=/api` while the web client expects `/api/v1`; migrations are not applied automatically and the API image does not ship them.
- **Logging**: invitation tokens (query string) and, on DB errors, bound parameters can reach logs.
- **Web session handling**: stale-session redirect on public pages, sign-out on transient refresh failure, no cross-tab auth sync, audit-log search fires per keystroke.

---

## 🔄 In Progress

None. All implementation phases (1 through 17) are 100% complete and operational in production.


---

## ⏭️ Future Roadmap (Post-Launch Enhancements)

**OAuth social login and Sentry production monitoring will be implemented in the future.**

- **OAuth Social Login**: Google and GitHub social authentication providers for `apps/web` and `apps/api`.
- **Sentry Production Monitoring**: Activating Sentry DSN for live error telemetry, alert channels, and distributed tracing.
- **Automated Testing Suite (Phase 18)**: Expanded integration and unit tests for multi-tenant isolation, RBAC chokepoints, and RAG accuracy.

---

## ⚠️ Conflicts / Decisions Required

See the [Conflicts section](#conflicts--decisions-required-detail) below.

---

## ❓ Missing Information / TODOs

| # | Item | Status | Impact / Implementation Resolution |
|---|------|--------|-----------------------------------|
| 1 | Exact embedding model name/version | ✅ **Resolved** | **Google Gemini API `gemini-embedding-001`** (768-dim L2-normalized) in Production; **`nomic-embed-text`** via Ollama for Local Dev |
| 2 | Exact LLM model name/version | ✅ **Resolved** | **Google Gemini API `gemini-3.6-flash`** in Production; **`qwen2.5:1.5b`** via Ollama for Local Dev |
| 3 | Production AI provider (Gemini vs Ollama) | ✅ **Resolved** | **Google Gemini API** (`gemini-3.6-flash`, `gemini-embedding-001`) confirmed as primary cloud production provider (DEC-030); Ollama is strictly local dev fallback |
| 4 | Exact email provider | ✅ **Resolved** | **Nodemailer (Gmail SMTP)** default / **Resend** custom domain (`apps/api/src/modules/email/email.service.ts`) |
| 5 | Maximum allowed file size | ✅ **Resolved** | **50MB** (`52,428,800` bytes) enforced in `env.ts` and `upload.middleware.ts` |
| 6 | Exact JWT / session authentication strategy | ✅ **Resolved** | **Dual-token**: 15m Access Token + 7d Refresh Token with rotation in `auth.service.ts` |
| 7 | Exact invitation expiration period | ✅ **Resolved** | **7 days** cryptographically signed invitation tokens in `invitation.service.ts` |
| 8 | Exact ADMIN permission matrix | ✅ **Resolved** | ADMIN manages memberships, invitations, and groups; cannot delete org or transfer ownership (OWNER only) |
| 9 | Whether users can create unlimited organizations | ✅ **Resolved** | **Unlimited**: any authenticated user can create an organization; creator becomes initial OWNER |
| 10 | Exact project deletion strategy | ✅ **Resolved** | **Hard delete with cascade**: PostgreSQL `ON DELETE CASCADE` purges project memberships, documents, chunks |
| 11 | Exact document deletion and retention strategy | ✅ **Resolved** | **Hard delete + Storage purge**: DB cascade deletes versions; MinIO/S3 objects are deleted via `StorageService` |
| 12 | Exact duplicate detection scope | ✅ **Resolved** | **Project-scoped SHA-256**: duplicate content in same project rejected (`409 Conflict`, `FR-DOC-005`) |
| 13 | Rate limiting rules | ✅ **Resolved** | In-memory fixed-window IP rate limiter implemented in `apps/api/src/middlewares/rate-limit.middleware.ts` for sensitive auth endpoints |
| 14 | AI answer evaluation metrics | ✅ **Resolved** | Source citation provenance with cosine similarity scores, confidence percentages, and `FR-AI-005` insufficient-evidence warning callouts |
| 15 | Whether OAuth social login is in scope for MVP | 🔮 **Future** | **OAuth social login will be implemented in the future.** |
| 16 | Production monitoring & Sentry | 🔮 **Future** | **Sentry production monitoring will be implemented in the future.** |
| 17 | Exact production deployment provider | ✅ **Resolved** | **AWS EC2 Free Tier (`t3.micro`) + Caddy SSL** for backend; **Vercel** for frontend (DEC-033) |
| 18 | Migration tooling choice (Flyway, Liquibase, raw SQL) | ✅ **Resolved** | Raw PostgreSQL baseline verified and active |
| 19 | Exact CI/CD provider | ✅ **Resolved** | **GitHub Actions** for EC2 backend + **Vercel Git Integration** for frontend (DEC-033) |
| 20 | Chunking strategy (chunk size, overlap) | ✅ **Resolved** | 1000 characters chunk size, 200 characters overlap with paragraph, sentence, and word boundary snapping (`apps/worker/src/chunker.py`) |
| 21 | Similarity threshold for "insufficient information" response | ✅ **Resolved** | Configurable similarity threshold (`MIN_SIMILARITY_SCORE`) with fallback response and citation suppression (`FR-AI-005`) |
| 22 | Whether historical document versions are searchable by default | ✅ **Resolved** | Default retrieval strictly scopes to `is_current = true` and `status = 'READY'` chunks |
| 23 | Streaming vs. non-streaming LLM responses | ✅ **Resolved** | Both supported: synchronous `POST /api/v1/rag/query` and Server-Sent Events (SSE) `POST /api/v1/rag/stream` with frontend streaming token rendering |
| 24 | Whether conversation history is included as LLM context | ✅ **Resolved** | Multi-turn conversational history loaded from database and prepended to prompt context |
| 25 | Object storage configuration (Dev vs Prod) | ✅ **Resolved** | **MinIO** (`http://localhost:9000`, development only) → **AWS S3** (production standard) via unified `@aws-sdk/client-s3` |

---

## Conflicts / Decisions Required (Detail)

### CONFLICT-001 — Email Provider (RESOLVED)

- **Status:** **Resolved — Nodemailer (Gmail SMTP) & Resend Confirmed & Implemented**
- **Location A:** `docs/system-architecture.md` → Nodemailer (Gmail SMTP) / Resend
- **Location B:** `AI Powered Workspace Architecture Diagram.png` → SendGrid / Mailgun alternatives
- **Resolution:**
  Nodemailer with Gmail SMTP (`smtp.gmail.com:465`) is implemented as the zero-cost, zero-domain provider for all authentication, invitation, and password reset flows (allowing instant delivery to any recipient via standard Google App Passwords). Resend remains fully supported for custom verified domains. The unified email module in `apps/api/src/modules/email/email.service.ts` auto-detects configured credentials and provides a mock console logger fallback for local offline development.

---

### CONFLICT-002 — Tailwind CSS vs. Vanilla CSS (RESOLVED)

- **Status:** **Resolved — Tailwind CSS v4 Confirmed & Implemented**
- **Location A:** `AI Powered Workspace Architecture Diagram.png` → Tailwind CSS + Shadcn/ui
- **Location B:** `docs/system-architecture.md` → Next.js + TypeScript
- **Resolution:**
  Implemented using Next.js 16 App Router paired with modern Tailwind CSS v4 and curated dark-mode design tokens, custom glassmorphism panels, glowing micro-accents, and custom scrollbars in `apps/web`. Zero runtime CSS overhead with full responsive control.

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

