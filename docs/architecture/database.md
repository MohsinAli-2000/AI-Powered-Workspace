# Database Model

> **Status:** Confirmed baseline — Schema implemented in PostgreSQL (`ai_workspace`: 20 tables, 6 enums).  
> **Sources:** `ERD/ERD Diagram.png`, `ERD/ERD.pdf`, system architecture decisions.  
> **Database:** PostgreSQL + pgvector  
> **Vector storage:** pgvector (integrated into PostgreSQL — do not replace without explicit decision)

---

## 1. Enums

### `organization_role`
```
OWNER
ADMIN
MEMBER
```

### `project_role`
```
PROJECT_MANAGER
PROJECT_MEMBER
```

### `document_access_mode`
```
PROJECT
RESTRICTED
```

### `document_effect`
```
ALLOW
DENY
```

### `document_version_status`
```
QUEUED
PROCESSING
READY
FAILED
```

### `message_role`
```
USER
ASSISTANT
SYSTEM
```

---

## 2. Core Entities

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `email` | varchar (not null, unique) | |
| `password_hash` | text (not null) | Bcrypt or equivalent |
| `name` | varchar (not null) | |
| `email_verified_at` | timestamp | null = not verified |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `email` (unique)

---

### `organizations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `name` | varchar (not null) | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

### `organization_memberships`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `user_id` | uuid (not null) | FK → users |
| `role` | organization_role (not null) | |
| `created_at` | timestamp | |

**Indexes:**
- `(user_id, organization_id)` UNIQUE — prevents duplicate membership

**Business rules:**
- One OWNER per organization
- One membership record per user/organization pair

---

### `invitations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `email` | varchar (not null) | |
| `role` | organization_role (not null) | Role to assign on acceptance (ADMIN, MEMBER) |
| `invited_by` | uuid (not null) | FK → users |
| `token_hash` | text | Secure SHA-256 token hash for invite link |
| `status` | varchar(20) (not null) | PENDING, ACCEPTED, REJECTED, REVOKED (default: PENDING) |
| `expires_at` | timestamp (not null) | |
| `accepted_at` | timestamp | null = not yet accepted |
| `created_at` | timestamp | |

**Indexes:**
- `(email, organization_id, status)`
- `(token_hash)`
- `(organization_id, created_at DESC)`
- `(organization_id)`, `(created_at)`

**Business rules:**
- Prevent duplicate active invitations for same email + organization (FR-MEMBER-004)

---

## 3. Projects

### `projects`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `name` | varchar (not null) | |
| `description` | text | |
| `created_by` | uuid | FK → users |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `(organization_id)`

---

### `project_memberships`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations (for query efficiency + integrity) |
| `project_id` | uuid (not null) | FK → projects |
| `user_id` | uuid (not null) | FK → users |
| `role` | project_role (not null) | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `(user_id, project_id)` UNIQUE — prevents duplicate project membership
- `(project_id)`, `(organization_id)`

**Business rules:**
- User must be an organization member before joining a project
- Project membership must belong to the project's organization

---

## 4. Groups

### `groups`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `name` | varchar (not null) | |
| `description` | text | |
| `created_by` | uuid | FK → users |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `(group_id)`, `(organization_id)`

---

### `group_memberships`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `group_id` | uuid (not null) | FK → groups |
| `user_id` | uuid (not null) | FK → users |
| `created_at` | timestamp | |

**Indexes:**
- `(user_id, group_id)` UNIQUE

**Business rules:**
- Group members must be members of the same organization

---

## 5. Documents

### `documents`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `project_id` | uuid (not null) | FK → projects |
| `name` | varchar (not null) | Display name |
| `description` | text | |
| `access_mode` | document_access_mode (not null) | PROJECT or RESTRICTED |
| `created_by` | uuid | FK → users |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `(project_id)`, `(organization_id)`

---

### `document_versions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_id` | uuid (not null) | FK → documents |
| `version_number` | integer (not null) | Monotonically increasing per document |
| `storage_key` | text (not null) | Object storage path/key |
| `original_filename` | text (not null) | Filename at time of upload |
| `mime_type` | varchar (not null) | |
| `file_size` | bigint (not null) | Bytes |
| `content_hash` | text (not null) | SHA-256 or equivalent for deduplication |
| `status` | document_version_status (not null) | QUEUED / PROCESSING / READY / FAILED |
| `is_current` | boolean (not null) | Only one current version per document |
| `created_by` | uuid | FK → users |
| `created_at` | timestamp | |
| `processed_at` | timestamp | When processing completed |
| `updated_at` | timestamp | |

**Indexes:**
- `(document_id, version_number)` UNIQUE — version number unique per document
- `(document_id)` WHERE `is_current = true` PARTIAL UNIQUE — one current version per document

**Business rules:**
- Historical versions are preserved
- Each version has its own processing status
- `content_hash` used for duplicate document detection

---

### `document_chunks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_version_id` | uuid (not null) | FK → document_versions |
| `chunk_index` | integer (not null) | Order within version |
| `content` | text (not null) | Extracted text content |
| `page_number` | integer | Where applicable |
| `metadata` | json | Additional metadata |
| `embedding` | vector | pgvector embedding |
| `created_at` | timestamp | |

**Indexes:**
- `(document_version_id, chunk_index)` UNIQUE
- Vector index on `embedding` (HNSW or IVFFlat via pgvector)
- `(document_version_id)`

---

## 6. Document Access Rules

### `document_user_access`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_id` | uuid (not null) | FK → documents |
| `user_id` | uuid (not null) | FK → users |
| `effect` | document_effect (not null) | ALLOW or DENY |
| `created_at` | timestamp | |

**Indexes:**
- `(document_id, user_id)` UNIQUE

---

### `document_group_access`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_id` | uuid (not null) | FK → documents |
| `group_id` | uuid (not null) | FK → groups |
| `effect` | document_effect (not null) | ALLOW or DENY |
| `created_at` | timestamp | |

**Indexes:**
- `(document_id, group_id)` UNIQUE

---

### `document_org_role_access`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_id` | uuid (not null) | FK → documents |
| `role` | organization_role (not null) | |
| `effect` | document_effect (not null) | ALLOW or DENY |
| `created_at` | timestamp | |

**Indexes:**
- `(document_id, role)` UNIQUE

---

### `document_project_role_access`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `document_id` | uuid (not null) | FK → documents |
| `role` | project_role (not null) | |
| `effect` | document_effect (not null) | ALLOW or DENY |
| `created_at` | timestamp | |

**Indexes:**
- `(document_id, role)` UNIQUE

---

## 7. Conversations & Messages

### `conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `created_by` | uuid (not null) | FK → users — private to creator |
| `title` | varchar | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Indexes:**
- `(organization_id, created_by)`

---

### `conversation_projects`

| Column | Type | Notes |
|--------|------|-------|
| `conversation_id` | uuid (not null) | FK → conversations |
| `project_id` | uuid (not null) | FK → projects |
| `organization_id` | uuid (not null) | FK → organizations (must match) |

**Indexes:**
- `(conversation_id, project_id)` UNIQUE (pk composite)

**Business rules:**
- Conversation project scope must belong to the same organization as the conversation
- Selecting a project in a conversation does NOT grant project access

---

### `messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `conversation_id` | uuid (not null) | FK → conversations |
| `role` | message_role (not null) | USER / ASSISTANT / SYSTEM |
| `content` | text (not null) | |
| `created_at` | timestamp | |

**Indexes:**
- `(conversation_id)`

---

### `message_sources`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `message_id` | uuid (not null) | FK → messages |
| `document_chunk_id` | uuid (not null) | FK → document_chunks |
| `rank` | integer | Ordering of sources by relevance |
| `similarity_score` | decimal | Cosine similarity or equivalent |
| `created_at` | timestamp | |

**Indexes:**
- `(message_id)`, `(document_chunk_id)`

**Provenance chain:**
```
Message Source
  → Document Chunk
    → Document Version
      → Document
        → Project
          → Organization
```

---

## 8. Audit Logs

### `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (pk) | |
| `organization_id` | uuid (not null) | FK → organizations |
| `actor_user_id` | uuid | FK → users (nullable for system events) |
| `action` | varchar (not null) | e.g., `member.invited`, `document.deleted` |
| `resource_type` | varchar (not null) | e.g., `organization`, `document`, `project` |
| `resource_id` | uuid | Target resource |
| `metadata` | json | Additional event-specific data |
| `created_at` | timestamp | |

**Indexes:**
- `(organization_id)`, `(actor_user_id)`, `(resource_type, resource_id)`, `(created_at)`

**Business rules:**
- Append-only — no updates or deletes
- Organization-scoped

---

## 9. Data Integrity Invariants

| Invariant | Rule |
|-----------|------|
| One OWNER | Exactly one OWNER per organization at all times |
| Single membership | One membership record per (user, organization) pair |
| Project organization scope | Project belongs to one organization |
| Project membership scope | Project membership must match project's organization |
| Org membership prerequisite | User must be org member before joining project |
| Group organization scope | Group belongs to one organization |
| Group member scope | Group members must be members of the same organization |
| Document scope | Document belongs to one project |
| Version uniqueness | Version number is unique per document |
| Single current version | Exactly one `is_current = true` version per document |
| Chunk uniqueness | Chunk index unique within a document version |
| Conversation org scope | Conversation belongs to one organization |
| Conversation project scope | Conversation project must match conversation's organization |
| Message ownership | Message belongs to one conversation |
| Source provenance | Message source points to exact document chunk |
| Authorization before RAG | Authorization resolved before any chunk is retrieved |

---

## 10. Deletion Strategy

Use deletion behaviors carefully.

### Cascade (tight dependencies)
- Document → Document Versions → Document Chunks
- Conversation → Messages → Message Sources
- Membership records with relevant parent/user lifecycle

### Explicit Service-Level Operations (must NOT blindly cascade)
- Organization deletion
- Project deletion
- Document deletion

Explicit service-level deletion must include:
1. Authorization check
2. Audit log entry
3. Cleanup of object-storage files
4. Cleanup of vector data (pgvector chunks)
5. Transaction handling

---

## 11. Technology

| Concern | Technology |
|---------|-----------|
| Relational data | PostgreSQL |
| Vector embeddings | pgvector (extension within PostgreSQL) |
| Object storage (dev) | MinIO |
| Object storage (prod) | AWS S3 |

> **Decision:** pgvector is the vector storage direction. Do not replace with a separate vector database unless explicitly decided.
