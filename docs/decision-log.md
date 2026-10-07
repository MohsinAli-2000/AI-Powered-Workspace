# Decision Log

> **Purpose:** Record of all confirmed architectural and product decisions.  
> **Status:** All decisions below are treated as the current confirmed baseline unless explicitly superseded.  
> **Note:** Dates are not available from repository history — only one commit exists. Phase-based ordering is used instead.

---

## Decision Format

```
Decision:         What was decided
Why:              Rationale
Status:           Confirmed / Under Review / Superseded
Phase:            When in the project lifecycle this was decided
Affected:         Which components/layers are affected
```

---

## Technology Decisions

---

### DEC-001 — PostgreSQL as Primary Database

```
Decision:  Use PostgreSQL as the primary relational database
Why:       Mature, production-proven, supports pgvector extension natively,
           avoids the need for a separate vector database infrastructure
Status:    Confirmed
Phase:     Architecture design
Affected:  Backend, AI Service, AI Worker, database schema
```

---

### DEC-002 — pgvector for Vector Storage

```
Decision:  Use pgvector (PostgreSQL extension) for storing and querying
           vector embeddings — NOT a separate vector database
Why:       Avoids additional infrastructure complexity; PostgreSQL handles
           both relational and vector data; tenant isolation is naturally
           enforced through existing organization_id scoping
Status:    Confirmed
Phase:     Architecture design
Affected:  AI Service, AI Worker, document_chunks table, RAG retrieval
```

---

### DEC-003 — RabbitMQ as Job Queue

```
Decision:  Use RabbitMQ for reliable asynchronous background job delivery
Why:       Reliable message delivery with ACK/NACK; supports retry patterns;
           decouples document upload from processing pipeline
Status:    Confirmed
Phase:     Architecture design
Affected:  Backend (Job Publisher), AI Worker (Consumer), queue infrastructure
```

---

### DEC-004 — Frontend / Backend / AI Service Separation

```
Decision:  Maintain three logically separate applications:
           (1) Next.js frontend
           (2) Node.js backend (core SaaS logic + authorization)
           (3) Python AI Service + AI Worker (RAG, processing, embeddings)
Why:       Separation of concerns; Python is more suitable for AI/ML workloads;
           Node.js is appropriate for REST API and SaaS business logic;
           Next.js provides SSR and full-stack React capabilities
Status:    Confirmed
Phase:     Architecture design
Affected:  All components — defines the deployment boundary
```

---

### DEC-005 — AI Provider Strategy: Ollama for Local Development Only → Google Gemini API for Production

```
Decision:  Use Ollama strictly as a local model runtime during development and offline testing;
           standardize on Google Gemini API (gemini-3.8-flash for LLM and gemini-embedding-001
           for 768-dim embeddings) as the primary cloud and production AI provider (see DEC-030).
Why:       Ollama enables zero-cost local prototyping without external API keys on developer machines;
           for production, Google Gemini API provides enterprise scalability, high token throughput,
           and low latency without the operational overhead of self-hosted GPU infrastructure.
Status:    Confirmed & Implemented (Development: Ollama | Production: Google Gemini API)
Phase:     Architecture design & implementation (Phase 11-14 + DEC-030)
Affected:  apps/ai-service, apps/worker, apps/api
```

---

### DEC-006 — Object Storage Strategy: MinIO for Local Development Only → AWS S3 for Production

```
Decision:  Use MinIO strictly as a local S3-compatible emulator during development;
           use AWS S3 as the standard production cloud object store, unified under
           the official @aws-sdk/client-s3 driver (see DEC-025).
Why:       MinIO provides exact S3 API compatibility locally with zero cloud AWS costs
           during local development; production relies on AWS S3 for enterprise durability,
           redundancy, and scalability. Transitioning from local dev to cloud production
           requires only changing environment variables (S3_ENDPOINT, AWS_REGION, credentials)
           with zero application code modifications.
Status:    Confirmed & Implemented (Phase 9 & DEC-025)
Phase:     Architecture design & implementation
Affected:  Backend (storage.service.ts), AI Worker (storage.py)
```

---

### DEC-007 — Nodemailer (Gmail SMTP) & Resend for Transactional Email

```
Decision:  Support Nodemailer (Gmail SMTP) as default zero-cost, zero-domain provider,
           alongside Resend for custom domain production environments, with graceful
           console logging mock fallback.
Why:       Resend requires verified custom domain ownership to send emails to arbitrary
           recipients. Nodemailer with Gmail App Passwords enables 100% free email
           dispatch (500 emails/day) for any recipient without upfront domain purchase.
           The unified EmailService abstraction handles both transparently.
Status:    Confirmed & Implemented (`apps/api/src/modules/email/email.service.ts`)
Phase:     Architecture design & implementation
Affected:  Backend Email Module (email.service.ts, env.ts)
```

---

### DEC-008 — Sentry for Monitoring and Error Tracking

```
Decision:  Use Sentry for error tracking, performance monitoring, and tracing
           across frontend, backend, AI service, and AI worker
Why:       Broad SDK support across Next.js, Node.js, and Python;
           provides distributed tracing across service boundaries
Status:    Confirmed
Phase:     Architecture design
Affected:  All deployed components
```

---

## Product / Domain Decisions

---

### DEC-009 — Project/Department Scope for Documents

```
Decision:  Every document belongs to a project/department scope within an
           organization; documents are not globally accessible merely because
           the user belongs to the organization
Why:       Enables organization-level compartmentalization of knowledge;
           HR documents should not be accessible to Finance team by default
Status:    Confirmed
Phase:     Product design
Affected:  Document model, authorization model, RAG retrieval filters
```

---

### DEC-010 — Group-Based Permissions

```
Decision:  Support groups as a unit of access control for documents, in
           addition to individual user rules
Why:       Assigning 500 individual document-permission rows for 500 users
           is not practical; groups allow efficient bulk permission management
Status:    Confirmed
Phase:     Product/architecture design
Affected:  groups, group_memberships, document_group_access tables;
           authorization evaluation pipeline
```

---

### DEC-011 — DENY Precedence in Document Authorization

```
Decision:  DENY has the highest precedence in the document access rule
           evaluation — if any applicable DENY rule matches the user,
           the user is denied even if an ALLOW rule also exists
Why:       Security-first design; prevents accidental over-granting of access
           through conflicting rules
Status:    Confirmed
Phase:     Authorization design
Affected:  Authorization evaluation logic, all document access rule tables
```

---

### DEC-012 — Private Organization-Scoped Conversations

```
Decision:  Conversations are private to the user who created them;
           they are scoped to one organization; another organization member
           must not automatically see someone else's conversation
Why:       AI conversations may contain sensitive queries or information;
           privacy is the default
Status:    Confirmed
Phase:     Product design
Affected:  conversations table, Conversation Module, RAG retrieval
```

---

### DEC-013 — Document Versioning
 
```
Decision:  Documents support multiple versions; historical versions are
           preserved; RAG provenance should identify which version
           supported an answer
Why:       Organizations may update documents over time; the ability to
           trace "previously X, now Y" requires version history
Status:    Confirmed & Implemented (Phase 9 Baseline)
Phase:     Architecture design & implementation
Affected:  document_versions, document_chunks tables; Document upload service
Note:      Initial uploads populate document_versions (version_number: 1,
           is_current: true, status: QUEUED). Modified files with identical
           names create new document records per FR-DOC-006.
```

---

### DEC-014 — RAG Provenance / Source References

```
Decision:  Every AI-generated answer must be traceable through:
           Message → Message Sources → Document Chunk → Document Version
           → Document → Project → Organization
Why:       Transparency and auditability; users need to verify AI answers
           against source documents
Status:    Confirmed
Phase:     Architecture design
Affected:  message_sources table, RAG orchestration, AI response format
```

---

### DEC-015 — Audit Logging in V1

```
Decision:  Audit logging is part of the V1 design; audit logs are
           append-only and organization-scoped
Why:       Security, compliance, and accountability requirements;
           important events must be traceable
Status:    Confirmed
Phase:     Architecture design
Affected:  audit_logs table; all major service operations
```

---

### DEC-016 — Authorization Before RAG Retrieval

```
Decision:  Authorization must be evaluated BEFORE any RAG retrieval;
           unauthorized document chunks must never be supplied to the
           retrieval or LLM pipeline
Why:       Prevents confidential information from leaking through AI answers;
           critical security requirement
Status:    Confirmed
Phase:     Authorization + RAG design
Affected:  AI Service (retrieval), Backend (auth scope computation)
```

---

### DEC-017 — Organization Admin Minimum Count Rule

```
Decision:  An organization must not be left with zero ADMINs; if there
           is only one ADMIN, the system prevents removal and notifies
           the administrator to promote another member first
Why:       Prevents management lockout scenarios; ensures the organization
           always has at least one non-owner administrative user
Status:    Confirmed
Phase:     Product design
Affected:  Member management service, role-change business logic
```

---

### DEC-018 — Project Manager Minimum Count Rule

```
Decision:  A project must not be left without a PROJECT_MANAGER; if the
           last PROJECT_MANAGER is being removed, another member must be
           promoted first
Why:       Prevents orphaned projects with no management authority
Status:    Confirmed
Phase:     Product design
Affected:  Project membership service, project manager change logic
```

---

### DEC-019 — User Deletion Scoped to Organization Membership

```
Decision:  Removing a user from one organization must NOT delete the user
           if they still belong to another organization; only when a user's
           final organization membership is removed should the user account
           be considered for removal
Why:       A user may legitimately belong to multiple organizations;
           removing one membership must not destroy unrelated data
Status:    Confirmed
Phase:     Product design
Affected:  Member removal service, user account lifecycle
```

---

### DEC-020 — Conversation Project Scope Does Not Grant Authorization

```
Decision:  Selecting a project in a conversation does not grant project
           membership or document access; actual project membership remains
           authoritative; conversation project scope only narrows retrieval
Why:       Prevents authorization bypass through conversation configuration
Status:    Confirmed
Phase:     Authorization + RAG design
Affected:  Conversation model, RAG retrieval filters
```

---

### DEC-021 — Dual-Token Authentication Strategy

```
Decision:  Use dual-token architecture: short-lived (15 min) JWT Access Tokens
           paired with long-lived (7 day) Refresh Tokens subject to single-use rotation
Why:       Minimizes exposure window if access token is intercepted; prevents
           replay attacks via cryptographic refresh token rotation
Status:    Confirmed & Implemented (Phase 4)
Phase:     Backend implementation
Affected:  Auth Module (auth.service.ts, auth.middleware.ts)
```

---

### DEC-022 — Hard Deletion with Database Cascade for Projects and Documents

```
Decision:  Apply hard deletion with foreign key cascading deletion (ON DELETE CASCADE)
           for projects and documents, coupled with storage object purging
Why:       Guarantees orphaned records, chunks, and sensitive files are completely
           purged from both PostgreSQL and MinIO / AWS S3
Status:    Confirmed & Implemented (Phase 7, Phase 9)
Phase:     Backend implementation
Affected:  project.service.ts, document.service.ts, storage.service.ts
```

---

### DEC-023 — Project-Scoped SHA-256 Document Content Deduplication

```
Decision:  Compute SHA-256 hash from file buffer on upload and enforce uniqueness
           per project scope (FR-DOC-005)
Why:       Prevents duplicate uploads and redundant AI embedding costs within
           a project while allowing identical files across different projects
Status:    Confirmed & Implemented (Phase 9)
Phase:     Backend implementation
Affected:  document.service.ts, document-version.repository.ts
```

---

### DEC-024 — 50MB File Upload Limit & Strict Document Format Whitelist

```
Decision:  Enforce a strict 50MB file size limit and restrict uploads to supported
           document formats (PDF, DOCX, XLSX, TXT, PPTX)
Why:       Prevents resource exhaustion, protects embedding pipeline from unsupported
           binaries and images, and aligns with FR-DOC-002 / FR-DOC-003
Status:    Confirmed & Implemented (Phase 9)
Phase:     Backend implementation
Affected:  upload.middleware.ts, document.schema.ts
```

---

### DEC-025 — Unified S3 Driver: MinIO for Local Development Only → AWS S3 for Production

```
Decision:  Use @aws-sdk/client-s3 with S3_FORCE_PATH_STYLE and configurable S3_ENDPOINT,
           using MinIO strictly for local development environments and AWS S3 for production.
Why:       MinIO was chosen strictly as a local development tool to eliminate AWS cloud costs
           on developer machines; the unified driver guarantees identical API semantics and
           seamless zero-code transition to AWS S3 in production.
Status:    Confirmed & Implemented (Phase 9)
Phase:     Backend implementation
Affected:  storage.service.ts, env.ts, storage.py
```

---

### DEC-026 — Asynchronous Worker Pipeline with Dead Letter Queuing & Thread-Safe Pooling

```
Decision:  Implement Python background worker (`apps/worker`) consuming `document-processing`
           from RabbitMQ with Dead Letter Queue (`document-processing-dlq`), ThreadedConnectionPool
           for PostgreSQL, and streaming S3 downloader with 50MB file size cap
Why:       Decouples CPU-intensive document extraction and chunking from the user-facing API;
           DLQ guarantees malformed or poison messages do not block the queue; thread-safe pooling
           eliminates database connection corruption across asynchronous events
Status:    Confirmed & Implemented (Phase 10)
Phase:     Worker implementation
Affected:  queue_consumer.py, db.py, storage.py, processor.py
```

---

### DEC-027 — Semantic Sliding-Window Document Chunking with Natural Boundary Snapping

```
Decision:  Use 1000-character chunk window with 200-character overlap, automatically snapping
           boundaries to paragraph breaks (`\n\n`), sentence/line breaks (`\n`), and word boundaries
Why:       Preserves semantic coherence and context continuity for dense vector embedding quality;
           word-boundary snapping prevents orphan partial-word tokens from degrading vector search
Status:    Confirmed & Implemented (Phase 10)
Phase:     Worker implementation
Affected:  chunker.py, normalizer.py
```

---

### DEC-028 — Embedding Architecture: Ollama (Local Dev Only) → Google Gemini API (Production)

```
Decision:  Use `nomic-embed-text` via Ollama strictly for local offline development;
           standardize on Google Gemini API (`gemini-embedding-001`, 768 dimensions)
           as the primary cloud/production embedding model.
Why:       Ollama provides zero-cost local CPU embedding without internet connectivity or API keys;
           for production, Gemini API delivers high-concurrency cloud throughput, low latency, and
           exact 768-dim vector compatibility with the pgvector HNSW index schema.
Status:    Confirmed & Implemented (Phase 11 & Phase 14)
Phase:     AI Worker, AI Service, Backend implementation
Affected:  apps/worker/src/embeddings/gemini.py, apps/ai-service/src/services/embedding_service.py,
           document_chunks table
```

---

### DEC-029 — Local Development LLM (Ollama qwen2.5:1.5b) for Offline Prototyping

```
Decision:  Configure `qwen2.5:1.5b` via Ollama as an optional local development model for
           offline iteration without API keys, with graceful retrieval fallback in `conversation.service.ts`.
Why:       Allows developers to test end-to-end prompt assembly on low-spec hardware without
           external API charges; cloud production uses Google Gemini API (DEC-030).
Status:    Confirmed & Implemented (Local Development Only)
Phase:     Backend RAG runtime optimization
Affected:  apps/api/.env, conversation.service.ts, ai-client.ts
```

---

### DEC-030 — Google Gemini API as Primary Production AI Provider

```
Decision:  Standardize on Google Gemini API as the primary production AI provider across the platform:
           `gemini-3.8-flash` for high-throughput grounded reasoning and SSE streaming, and
           `gemini-embedding-001` (768 dimensions) for dense vector embeddings.
           Local Ollama and mock providers are retained strictly as development alternatives.
Why:       Self-hosting LLMs in production requires expensive dedicated GPU instances (e.g. EC2 g5).
           Gemini API provides enterprise SLA, fast response times, and generous free/low-cost
           pricing tiers, while 768-dim output preserves existing pgvector HNSW indexes without migration.
Status:    Confirmed & Implemented (Production Standard)
Phase:     Production AI Service & Worker Optimization
Affected:  apps/ai-service/src/providers/gemini.py, apps/worker/src/embeddings/gemini.py,
           apps/api/.env (AI_PROVIDER=ai-service), .env.example files
```

---

### DEC-031 — Neon Serverless Postgres for Cloud & Production Deployment

```
Decision:  Migrate database from local PostgreSQL container to Neon Serverless PostgreSQL
           (AWS us-east-1) with `pgvector` extension enabled and built-in PgBouncer pooling.
           Use the pooled connection string (`-pooler`) for stateful and serverless applications
           (API, AI Service, Worker) and direct unpooled connection for schema migrations.
Why:       Provides a production-grade, zero-cost cloud database ideal for portfolio deployment.
           Supports serverless scale-to-zero, native pgvector support for 768-dimensional embeddings,
           automatic backups, and instant Vercel / Cloud deployment integration without requiring
           a self-managed PostgreSQL server.
Status:    Confirmed & Implemented
Phase:     Deployment & Cloud Migration
Affected:  apps/api/.env, apps/worker/.env, apps/ai-service/.env, PostgreSQL schema & data
```

---

### DEC-032 — Platform Owner Administration, Tenant Suspension & Permanent Deletion

```
Decision:  Implement a dedicated Platform Owner role (`users.is_platform_admin: boolean`)
           managed strictly via an offline/secure CLI tool (`npm run platform-admin -- grant/revoke <email>`),
           paired with an organization status lifecycle (`organizations.status`: `'ACTIVE' | 'SUSPENDED'`),
           and a privacy-preserving admin dashboard at `/admin`.
           Lifecycle & Enforcement capabilities:
           1. Suspension & Member Lockout:
              - All members (including OWNER and ADMINs) are immediately locked out from workspace
                resources (documents, projects, chat, groups) with 403 ORGANIZATION_SUSPENDED.
              - Data is 100% preserved.
              - The primary organization owner is automatically emailed a formal notice containing
                the specified suspension reason.
           2. Permanent Deletion & Full Data Purge:
              - The platform owner can permanently delete any suspended organization.
              - 100% data purge: All document records, chunks, vectors, projects, conversations,
                and memberships are CASCADE deleted at the database level.
              - Storage purge: All object storage files (S3/MinIO) are enumerated and purged.
              - An email notification is automatically dispatched to the organization owner
                confirming the irreversible deletion of their organization.
           3. Zero-Knowledge Privacy Boundary:
              - The platform owner dashboard only surfaces aggregate metadata (counts, storage bytes,
                owner email, created date). Tenant document contents, file titles, vector chunks,
                and conversation histories remain strictly inaccessible.
Why:       Provides the product owner complete operational governance to suspend or permanently delete
           violating organizations, maintains compliance and automated customer communications via email,
           and guarantees clean storage/database reclamation without violating tenant privacy.
Status:    Confirmed & Implemented
Phase:     Platform Administration & Governance
Affected:  apps/api/migrations/001_platform_admin.sql,
           apps/api/migrations/002_allow_audit_log_purge_on_org_delete.sql,
           apps/api/src/scripts/platform-admin.ts, apps/api/src/modules/platform-admin/*,
           apps/api/src/modules/email/email.service.ts,
           apps/api/src/modules/organizations/organization.repository.ts,
           apps/web/src/app/(dashboard)/admin/page.tsx
```

---

### DEC-033 — Multimodal AI Vision OCR & Document Image Extraction Pipeline

```
Decision:  Expand supported document formats to include raster images (.png, .jpg, .jpeg, .jfif, .webp, .bmp, .tiff, .tif, .gif)
           processed via multimodal AI Vision OCR (Google Gemini Vision API `gemini-3.6-flash`, with seamless fallback
           sequence across `gemini-3-flash-preview`, `gemini-flash-lite-latest`, and `gemini-3.1-flash-lite`).
           Architecture & Pipeline Capabilities:
           1. In-Memory Image Format Normalization:
              - Python background worker (`ImageExtractor`) utilizes Pillow (PIL) to inspect image geometry, dimensions,
                and color modes.
              - Standard formats (PNG, JPEG, WEBP) stream directly to Gemini inlineData; legacy/unsupported image formats
                (BMP, TIFF, GIF) are dynamically converted in-memory to PNG before transmission.
           2. Multimodal OCR & Semantic Structure Extraction:
              - Extracts plain text, tables, infographics, hierarchical key-value pairs, and transcribes architectural/system
                diagram flowcharts into structured GitHub-flavored Markdown.
              - In the event of temporary upstream 503 spikes or rate limits, retries with exponential backoff and automatically
                falls back across the prioritized model chain.
           3. End-to-End RAG & Citation Integration:
              - Image text chunks are chunked, normalized, and embedded into 768-dimensional vectors using `gemini-embedding-001`,
                stored in PostgreSQL `document_chunks` with `is_image: true` metadata.
              - Semantic vector retrieval and authorization subqueries seamlessly treat image content as first-class knowledge sources.
              - Frontend chat displays dedicated violet `ImageIcon` pills, "Image OCR" badges, and relevance metrics in the source citation drawer.
           4. File Upload & Format Whitelisting:
              - Upload middleware and Zod schemas whitelist image MIME types and extensions with a 50MB per-file safety cap.
              - Frontend upload zone provides instant client-side thumbnail image previews prior to upload dispatch.
Why:       Enterprise documentation frequently contains architecture diagrams, scanned invoices, receipts, charts, flowcharts,
           and presentation infographics. Supporting multimodal vision unlocks previously opaque visual data for grounded RAG,
           eliminates separate bulky Tesseract OCR native binary dependencies in container images, and provides superior extraction
           accuracy for complex diagrams.
Status:    Confirmed & Implemented
Phase:     Multimodal Vision & Document Intelligence
Affected:  apps/worker/src/extractors/image.py, apps/worker/src/extractors/__init__.py,
           apps/worker/src/config.py, apps/ai-service/src/services/utility_service.py,
           apps/ai-service/src/routers/utils.py, apps/ai-service/.env,
           apps/api/src/modules/documents/document.schema.ts, apps/api/src/middlewares/upload.middleware.ts,
           apps/web/src/components/documents/document-upload-zone.tsx,
           apps/web/src/components/documents/document-table.tsx,
           apps/web/src/components/chat/citation-pill.tsx,
           apps/web/src/components/chat/source-citation-drawer.tsx
```



