# AI Knowledge Workspace — Product Idea

> **Source:** `product-idea.md` (root) + `docs/functional-requirements.md` Section 2  
> **Status:** Confirmed baseline. Do not modify without team agreement.

---

## 1. What Are We Building?

We are building a **multi-tenant AI Knowledge Workspace** for organizations.

Users can:
- Create an organization
- Invite team members
- Assign roles
- Manage organizational resources
- Upload documents
- Use an AI assistant to search, analyze, summarize, and answer questions based on the organization's knowledge

---

## 2. Who Will Use It?

**Primary users:** Small and medium-sized companies or teams that have accumulated large collections of internal documents and need a faster way to find and understand information from those documents.

---

## 3. What Problem Does It Solve?

Important organizational knowledge is often buried inside old documents, reports, manuals, policies, and other files.

Employees may spend significant time manually searching through files to find relevant information.

Our system allows organizations to:
- Preserve their original documents
- Extract and organize knowledge into a searchable AI-powered knowledge system
- Allow users to ask questions in natural language and receive answers based on relevant documents and sources

---

## 4. Three Most Important Features

### A. Organization and Team Management

Users can create organizations, invite and remove members, and assign roles with different permissions.

### B. Document Knowledge Management

Authorized members can upload documents, monitor their processing status, and make organizational knowledge available for search and AI analysis.

### C. AI-Powered Knowledge Assistant

Users can ask questions about organizational documents. The system retrieves relevant information and generates grounded answers with source references while minimizing unsupported answers.

---

## 5. Definition of MVP Success

The MVP will be considered functionally successful when the following complete flow works end-to-end:

> A new user can register and verify their email, create an organization, become its owner, create a project, invite a team member with a predefined role, allow the member to join the organization, upload a supported non-duplicate document, process that document asynchronously into searchable knowledge, ask a question about the document, and receive a grounded AI-generated answer with source references — while ensuring that users from another organization cannot access the organization's data or AI knowledge.

---

## 6. MVP Constraints (Out of Scope for Initial Version)

- Image OCR and image understanding
- Automatic deletion of old documents
- Automatic AI decisions about which documents are valuable
- Full document versioning (versioning design exists but not MVP implementation)
- Custom user-defined roles
- Multiple simultaneous owners
- Complex document-level permission systems
- Automatic document merging
- Guaranteed zero AI hallucinations

---

## 7. Open Questions / Decisions Not Yet Finalized

| Item | Status |
|------|--------|
| Maximum allowed file size | `TODO — DECISION REQUIRED` |
| Exact session/token authentication strategy | `TODO — DECISION REQUIRED` |
| Exact invitation expiration period | `TODO — DECISION REQUIRED` |
| Exact ADMIN permission matrix | `TODO — DECISION REQUIRED` |
| Whether users can create unlimited organizations | `TODO — DECISION REQUIRED` |
| Exact project deletion strategy (hard/soft/archive) | `TODO — DECISION REQUIRED` |
| Exact document deletion and retention strategy | `TODO — DECISION REQUIRED` |
| Exact duplicate detection scope (org-wide or project-wide) | `TODO — DECISION REQUIRED` |
| Rate limiting rules | `TODO — DECISION REQUIRED` |
| AI answer evaluation metrics | `TODO — DECISION REQUIRED` |
