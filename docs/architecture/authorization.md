# Authorization Model

> **Status:** Confirmed baseline — agreed design decisions.  
> **Source:** Functional requirements, system architecture, and agreed product decisions.

---

## 1. Overview

The authorization model is multi-layered and combines:

- Organization membership (role-based)
- Project membership (role-based)
- Document-level access control (scope + effect-based rules)
- Group-based access (for efficient bulk permissions)

Authorization must be evaluated entirely **server-side**. Frontend controls are supplementary only and must never be the sole authorization mechanism.

---

## 2. Organization Roles

### Enum: `organization_role`

| Role | Description |
|------|-------------|
| `OWNER` | Full control over the organization and all its resources |
| `ADMIN` | Manages membership; does not automatically control every project |
| `MEMBER` | Regular user with access to authorized resources |

### Rules

- An organization has **exactly one OWNER** at all times.
- A user's organization role is **organization-specific** (stored through `organization_memberships`).
- A user may belong to **multiple organizations** with different roles in each.
- Removing a user from Organization A must **not** affect their membership in Organization B.
- **OWNER** has full access to everything inside their organization.
- **ADMIN** can manage organization membership but does **not** automatically receive project-management permissions for every project.
- ADMIN **cannot** remove the OWNER.
- ADMIN **cannot** remove another ADMIN if that would leave the organization with zero ADMINs.

### ADMIN Minimum Count Rule

> An organization must not be left with zero ADMINs.

If there is only one ADMIN, the system must prevent their removal and notify that another member must first be promoted to ADMIN.

---

## 3. Project Roles

### Enum: `project_role`

| Role | Description |
|------|-------------|
| `PROJECT_MANAGER` | Manages project membership and project resources |
| `PROJECT_MEMBER` | Regular access to project resources |

### Rules

- Project membership is **separate** from organization membership.
- A user must be an **organization member** before they can join a project.
- An organization ADMIN does **not** automatically have project-management authority over every project.
- A project must **not** be left without a PROJECT_MANAGER.

### Project Manager Minimum Count Rule

> If the last PROJECT_MANAGER is being removed, another eligible member must first become PROJECT_MANAGER. Only then can the previous project manager be removed.

If a project manager is removed through an administrative process, the OWNER must be able to assign a new project manager.

---

## 4. Group Model

Groups provide enterprise-grade access control for bulk permissions without creating individual access rules for every user.

### Rules

- Groups are **organization-scoped**.
- A user can belong to **multiple groups**.
- A group from Organization A must **never** contain a user who is not a member of Organization A.
- Group examples: "Executive Team", "HR Leadership", "Finance Team", "Engineering Leads"

### Access Pattern

```text
Document
  → Group Access Rule
    → Group
      → Group Members (organization members)
```

---

## 5. Document Access Model

### Document Access Modes

| Mode | Description |
|------|-------------|
| `PROJECT` | Accessible to all authorized project members |
| `RESTRICTED` | Subject to additional per-user/group/role access rules |

### Access Rule Types (for RESTRICTED documents)

Rules can grant/deny access based on:
- **Individual user** (`document_user_access`)
- **Group** (`document_group_access`)
- **Organization role** (`document_org_role_access`)
- **Project role** (`document_project_role_access`)

### Document Effect Enum

| Effect | Description |
|--------|-------------|
| `ALLOW` | Grants access to the document |
| `DENY` | Denies access — highest precedence |

---

## 6. Authorization Evaluation Order

This is the **critical** authorization pipeline. Every step must pass.

```text
1. Verify user is authenticated
2. Verify user belongs to the organization
3. Verify user has access to the project (project membership check)
4. Check document scope (PROJECT or RESTRICTED)
5. If RESTRICTED:
   a. Collect all applicable access rules for the user
      (individual, group, org role, project role)
   b. If ANY matching rule has effect = DENY → DENY (highest precedence)
   c. If a matching rule has effect = ALLOW → ALLOW
   d. If no matching rule → DENY (default deny for restricted documents)
6. Authorization complete → proceed to resource access
```

### DENY Precedence Rule

> **`DENY` has the highest precedence.**  
> If any applicable DENY rule matches the user, the user is denied even if an ALLOW rule also exists.

---

## 7. RAG Authorization Integration

Authorization must be evaluated **before** RAG retrieval. Unauthorized document chunks must **never** be supplied to the retrieval or LLM pipeline.

```text
User submits question
  ↓
Backend validates organization context
  ↓
Backend checks membership and permissions
  ↓
Backend computes authorized document scope for this user
  ↓
AI Service performs similarity search WITH scope filter applied
  ↓
Only authorized chunks are returned to the LLM
  ↓
LLM generates answer from authorized context only
```

### RAG Authorization Rules

The RAG system must NOT:
1. Retrieve unauthorized chunks
2. Send unauthorized chunks to the LLM
3. Reveal confidential information indirectly
4. Allow a user to bypass permissions by asking a different question
5. Expose information from another organization

**A similarity search without tenant and authorization filtering is never allowed.**

---

## 8. Conversation Authorization

- Conversations are **private to the user** who created them.
- Conversations are **organization-scoped**.
- Another member of the organization must not automatically see someone else's conversation.
- A conversation may optionally contain one or more **project scopes**.
- Selecting a project in a conversation does **not** grant project access.
- Retrieval still uses the user's **actual authorization** (project membership).
- If a user loses their membership from an organization, their organization-scoped conversations should be removed according to the deletion policy.

---

## 9. Tenant Isolation

**Tenant isolation is a critical security requirement.**

Every organization-owned resource must be scoped by `organization_id`.

For every request on an organization-owned resource, the backend must verify:
1. User is authenticated
2. User belongs to the organization
3. User has permission to perform the requested action on that resource

Changing a resource identifier in a request (e.g., manipulating UUIDs) must not allow access to another organization's data.

---

## 10. Data Integrity Invariants Related to Authorization

| Invariant | Rule |
|-----------|------|
| Single owner | One and only one OWNER per organization |
| Project scope | Project belongs to one organization only |
| Project membership scope | Project membership must belong to the project's organization |
| Org membership required | User must belong to organization before joining a project |
| Group scope | Group belongs to one organization; members must be org members |
| Authorization before RAG | Document authorization resolved before any RAG retrieval |
