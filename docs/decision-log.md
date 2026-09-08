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

### DEC-005 — Ollama for Initial Embedding and LLM Runtime

```
Decision:  Use Ollama as the local model runtime for initial development
           (embedding model and LLM via Qwen or similar)
Why:       Zero-cost development, local execution, no API keys required
           for initial builds; can be swapped for cloud providers in production
Status:    Confirmed (for development)
Phase:     Architecture design
Affected:  AI Service, AI Worker, Embedding Pipeline, RAG orchestration
Note:      Production LLM and embedding provider not yet finalized
           (TODO — DECISION REQUIRED)
```

---

### DEC-006 — Object Storage: MinIO (dev) → AWS S3 (prod)

```
Decision:  Use MinIO locally for development, AWS S3 for production, unified
           under the official @aws-sdk/client-s3 driver
Why:       MinIO is S3-compatible, enabling local development with zero AWS costs;
           production uses AWS S3 for scalability; switching environments
           requires only changing environment variables with zero code changes
Status:    Confirmed & Implemented (Phase 9)
Phase:     Architecture design & implementation
Affected:  Backend (document upload, storage.service.ts), AI Worker (file download)
```

---

### DEC-007 — Resend for Transactional Email

```
Decision:  Use Resend for transactional email (verification, invitations,
           password reset)
Why:       Modern, developer-friendly email API; clean abstraction in EmailService
Status:    Confirmed & Implemented (Phase 4, Phase 6; CONFLICT-001 resolved)
Phase:     Architecture design & implementation
Affected:  Backend Email Module (email.service.ts)
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

### DEC-025 — Unified S3 Driver with MinIO (Dev) and AWS S3 (Prod) Parity

```
Decision:  Use @aws-sdk/client-s3 with S3_FORCE_PATH_STYLE and configurable S3_ENDPOINT
           to support local MinIO in development and AWS S3 in production
Why:       Zero cloud infrastructure costs during local development while guaranteeing
           zero code changes when deploying to AWS S3 in production
Status:    Confirmed & Implemented (Phase 9)
Phase:     Backend implementation
Affected:  storage.service.ts, env.ts
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


