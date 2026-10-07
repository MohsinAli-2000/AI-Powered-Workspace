> **Note:** This file has been reorganized. The canonical copy is at `docs/requirements/functional-requirements.md`. This file is preserved for reference.

# AI Knowledge Workspace — Functional Requirements

## 1. Document Purpose

This document defines the functional requirements for the AI Knowledge Workspace.

The application allows organizations to create a private knowledge workspace, invite team members, upload organizational documents, process those documents into searchable knowledge, and ask an AI assistant questions based on the available organizational knowledge.

The system must ensure the following:

- Secure user authentication
- Organization-level data isolation
- Role-based access control
- Controlled member management
- Secure document management
- Duplicate document prevention
- Asynchronous document processing
- AI answers grounded in authorized organizational knowledge
- Source references for AI-generated answers

---

## 2. Product Overview

The application is a multi-tenant AI Knowledge Workspace.

A user can:

- Create an account
- Verify their email address
- Create an organization
- Become the owner of that organization
- Invite other users to join
- Assign roles to invited members
- Upload supported organizational documents
- Process those documents into searchable knowledge
- Ask questions using natural language
- Receive answers based on relevant organizational documents
- View the source documents used to generate answers

Each organization must have isolated data.

A user from one organization must not be able to access documents, projects, conversations, or AI knowledge belonging to another organization.

---

## 3. User Roles

The MVP will support three roles:

- OWNER
- ADMIN
- MEMBER

### 3.1 OWNER

The OWNER is the primary controller of an organization.

The OWNER can:

- Manage organization settings
- Invite members
- Assign member roles
- Change member roles
- Remove members
- Manage organizational documents
- Manage projects
- Access organization-level resources
- Transfer organization ownership
- Delete the organization

Restrictions:

- An organization must have exactly one OWNER at a time.
- The OWNER cannot leave the organization unless ownership is transferred to another member.
- An OWNER cannot be removed without first transferring ownership.

### 3.2 ADMIN

An ADMIN is a trusted organization member with elevated permissions.

The ADMIN can:

- Invite new members
- Manage MEMBER accounts
- Manage documents
- Manage projects
- Access organization-level resources
- Use the AI Knowledge Assistant

The ADMIN cannot:

- Remove the OWNER
- Change the OWNER role
- Delete the organization
- Transfer organization ownership
- Perform actions reserved exclusively for the OWNER

> Note: The exact permissions of ADMIN may be refined later, but the system must support clear role-based authorization rules.

### 3.3 MEMBER

A MEMBER is a regular organization user.

The MEMBER can:

- Access authorized organization resources
- Upload documents if the organization policy allows it
- View authorized documents
- Ask questions using the AI Knowledge Assistant
- View their authorized conversations

The MEMBER cannot:

- Manage organization settings
- Manage organization roles
- Change other users' permissions
- Remove members
- Delete the organization

---

## 4. Authentication Requirements

### FR-AUTH-001 — User Registration

The system shall allow a new user to create an account using:

- Email address
- Password

### FR-AUTH-002 — Unique Email Address

The system shall prevent more than one user account from being registered with the same email address.

If the email address already exists, the system shall return an appropriate error message.

### FR-AUTH-003 — Password Security

The system shall securely store user passwords using a secure password hashing mechanism.

The system shall never store plaintext passwords.

### FR-AUTH-004 — Email Verification

The system shall require a user to verify ownership of their email address.

The system shall send a verification mechanism to the user's registered email address.

### FR-AUTH-005 — Access Before Verification

The system shall prevent unverified users from accessing protected application features.

A user may verify their email address and complete required onboarding actions.

### FR-AUTH-006 — User Login

The system shall allow a registered and verified user to log in using valid credentials.

### FR-AUTH-007 — Invalid Login

The system shall reject login attempts when:

- The email address does not exist
- The password is incorrect
- The account is not permitted to authenticate

The system should avoid exposing unnecessary information that could help attackers determine whether a particular email address exists.

### FR-AUTH-008 — Protected Resources

The system shall prevent unauthenticated users from accessing protected resources.

Protected resources include:

- Organization data
- Member data
- Projects
- Documents
- AI conversations
- AI knowledge endpoints

### FR-AUTH-009 — User Logout

The system shall allow an authenticated user to securely log out.

After logout, the user's authentication session shall no longer provide access to protected resources.

---

## 5. Organization Requirements

### FR-ORG-001 — Create Organization

The system shall allow a verified user to create an organization.

The organization shall have a user-provided name.

### FR-ORG-002 — Organization Owner

The user who creates an organization shall automatically become the OWNER of that organization.

### FR-ORG-003 — Single Owner Rule

An organization shall have exactly one OWNER at a time.

### FR-ORG-004 — View Organizations

The system shall allow a user to view all organizations to which they belong.

A user may belong to multiple organizations.

### FR-ORG-005 — Organization Access

The system shall only allow users who are members of an organization to access that organization's resources.

### FR-ORG-006 — Update Organization

The OWNER shall be allowed to update organization settings and permitted organization information.

### FR-ORG-007 — Transfer Ownership

The current OWNER shall be able to transfer ownership to another existing organization member.

After ownership is transferred:

- The selected member shall become the new OWNER
- The previous OWNER shall no longer be the organization owner
- The organization must continue to have exactly one owner

### FR-ORG-008 — Owner Leaving Organization

The system shall prevent the OWNER from leaving an organization unless ownership has first been transferred to another member.

### FR-ORG-009 — Delete Organization

Only the OWNER shall be allowed to delete the organization.

The exact data-retention and deletion strategy will be defined separately.

---

## 6. Member and Invitation Requirements

### FR-MEMBER-001 — Invite Member

The system shall allow an authorized user to invite another person to an organization using their email address.

### FR-MEMBER-002 — Assign Role Before Invitation

The system shall require the inviter to assign a valid role before sending the invitation.

The role shall be associated with the invitation.

### FR-MEMBER-003 — Prevent Duplicate Membership

The system shall prevent a user from being added to the same organization more than once.

### FR-MEMBER-004 — Prevent Duplicate Active Invitations

The system shall prevent multiple active invitations from being created for the same email address and organization.

### FR-MEMBER-005 — Receive Invitation

The system shall send an organization invitation to the specified email address.

The invitation shall identify:

- The organization
- The assigned role
- The invitation action

### FR-MEMBER-006 — Accept or Reject Invitation

The invited user shall be able to:

- Accept the invitation
- Reject the invitation

### FR-MEMBER-007 — Existing User Invitation Flow

If the invited email address belongs to an existing user account, the system shall require the user to authenticate before accepting the invitation.

### FR-MEMBER-008 — New User Invitation Flow

If the invited email address does not belong to an existing user account, the system shall allow the invited person to:

- Create an account
- Create a password
- Verify their email address
- Accept the organization invitation

The invitation shall only be accepted by the user associated with the invited email address.

### FR-MEMBER-009 — Apply Assigned Role

When an invitation is accepted, the system shall add the user to the organization using the role assigned when the invitation was created.

### FR-MEMBER-010 — Remove Member

Only the OWNER shall be allowed to remove organization members in the MVP.

The system shall prevent the OWNER from removing themselves without transferring ownership first.

### FR-MEMBER-011 — Change Member Role

Authorized users shall be allowed to change member roles according to the role permission rules.

The system shall prevent unauthorized role changes.

### FR-MEMBER-012 — Owner Protection

No user shall be allowed to:

- Remove the current OWNER
- Change the current OWNER role directly
- Create a second simultaneous OWNER

Ownership changes must occur through the ownership transfer process.

---

## 7. Authorization and Data Isolation Requirements

### FR-AUTHZ-001 — Role-Based Authorization

The system shall enforce authorization based on the user's role within the currently selected organization.

### FR-AUTHZ-002 — Organization Data Isolation

A user shall not be able to access resources belonging to an organization of which they are not a member.

This applies to:

- Members
- Projects
- Documents
- Document chunks
- AI conversations
- Messages
- AI knowledge
- Background jobs

### FR-AUTHZ-003 — Server-Side Authorization

The backend shall independently verify authorization.

The system shall not rely only on frontend controls to protect sensitive resources.

### FR-AUTHZ-004 — Resource Identifier Protection

Changing a resource identifier in a request must not allow a user to access another organization's data.

For every organization-owned resource, the system shall verify:

- The user is authenticated
- The user belongs to the organization
- The user has permission to perform the requested action

---

## 8. Project Requirements

Projects are used to organize organizational knowledge into logical areas.

### Example structure

```text
Organization
├── HR Knowledge
│   ├── HR documents
│   └── HR AI conversations
├── Engineering Knowledge
│   ├── Technical documents
│   └── Technical AI conversations
└── Company Policies
    ├── Policy documents
    └── Policy AI conversations
```

### FR-PROJECT-001 — Create Project

Authorized users shall be able to create a project within an organization.

### FR-PROJECT-002 — View Projects

Organization members shall be able to view projects that they are authorized to access.

### FR-PROJECT-003 — Update Project

Authorized users shall be able to update project information.

### FR-PROJECT-004 — Delete Project

Only authorized users shall be able to delete or archive a project.

The exact deletion strategy will be finalized during technical design.

### FR-PROJECT-005 — Project Isolation

A project shall belong to exactly one organization.

A user from another organization must not be able to access the project or its associated resources.

---

## 9. Document Management Requirements

### FR-DOC-001 — Upload Document

Authorized users shall be able to upload supported documents to an organization project.

### FR-DOC-002 — Supported File Types

The platform supports structured text documents, office presentations, spreadsheets, and raster image files:

- PDF (`.pdf`)
- DOCX (`.docx`)
- XLSX (`.xlsx`)
- TXT (`.txt`)
- PPTX (`.pptx`)
- Images: PNG (`.png`), JPEG (`.jpg`, `.jpeg`, `.jfif`), WebP (`.webp`), Bitmap (`.bmp`), TIFF (`.tiff`, `.tif`), GIF (`.gif`)

The system shall reject unsupported file types.

### FR-DOC-003 — Multimodal AI Vision OCR & Image Processing

The system processes uploaded image files using multimodal AI vision (`gemini-3.6-flash` with automatic fallback sequence):

- Optical character recognition (OCR) of all text, numerical data, tables, and labels.
- Structural comprehension and transcription of infographics, architectural workflow diagrams, and flowcharts into clean Markdown.
- Semantic sliding-window chunking, 768-dim vector embedding, and citation grounding identical to text documents.

### FR-DOC-004 — File Validation

The system shall validate:

- File type
- File size
- Upload eligibility

before accepting a document for processing.

The maximum file size will be defined during technical design.

### FR-DOC-005 — Duplicate Document Prevention

The system shall detect duplicate document content within the same organization or project scope.

The system shall prevent identical document content from being unnecessarily uploaded multiple times.

Duplicate detection shall not rely only on the filename.

### FR-DOC-006 — Modified Documents

The system shall allow a document with modified or different content to be uploaded, even if its filename is identical to an existing document.

For the MVP, modified documents may be treated as new documents.

Document versioning is outside the initial MVP scope.

### FR-DOC-007 — Document Ownership

Each uploaded document shall belong to:

- One organization
- One project

The system shall maintain the relationship between the document and its organization/project.

### FR-DOC-008 — View Documents

Authorized users shall be able to view the documents available within their authorized organization/project scope.

### FR-DOC-009 — Document Processing Status

The system shall expose the current processing status of an uploaded document.

Initial processing states may include:

- UPLOADED
- QUEUED
- PROCESSING
- READY
- FAILED

### FR-DOC-010 — Failed Processing

If document processing fails, the system shall:

- Mark the document processing status as failed
- Prevent incomplete knowledge from being treated as ready
- Allow the failure to be identified for debugging

A retry mechanism may be implemented during the background job phase.

### FR-DOC-011 — Delete Document

Authorized users shall be able to delete documents according to role permissions.

When a document is deleted, the system must ensure that associated searchable knowledge is no longer available for AI retrieval.

This includes relevant:

- Extracted content
- Chunks
- Embeddings/vector records

---

## 10. Document Processing Requirements

Document processing shall occur asynchronously and shall not unnecessarily block the user's upload request.

The expected high-level flow is:

```text
User uploads document
        ↓
File validation
        ↓
File stored
        ↓
Document record created
        ↓
Processing job created
        ↓
Worker processes document
        ↓
Text extracted
        ↓
Text cleaned/normalized
        ↓
Text split into chunks
        ↓
Embeddings generated
        ↓
Knowledge stored
        ↓
Document status = READY
```

### FR-PROCESS-001 — Background Processing

The system shall process documents asynchronously.

### FR-PROCESS-002 — Text Extraction

The system shall extract relevant textual content from supported document formats.

### FR-PROCESS-003 — Text Processing

The system shall prepare extracted text for retrieval and AI processing.

This may include:

- Cleaning
- Normalization
- Chunking

### FR-PROCESS-004 — Embedding Generation

The system shall generate embeddings for processed document knowledge.

### FR-PROCESS-005 — Knowledge Availability

The system shall only make document knowledge available for AI retrieval after successful processing.

### FR-PROCESS-006 — Failed Knowledge Isolation

The system shall not use incomplete or failed document processing results as reliable AI knowledge.

---

## 11. AI Knowledge Assistant Requirements

### FR-AI-001 — Ask Questions

The system shall allow an authorized user to ask questions using natural language.

### FR-AI-002 — Scoped Knowledge Retrieval

The system shall retrieve information only from the relevant authorized organization/project knowledge scope.

The system must not retrieve knowledge belonging to another organization.

### FR-AI-003 — Retrieval Before Generation

The system shall retrieve relevant document knowledge before generating an AI response.

The retrieved information shall be used as context for the answer.

### FR-AI-004 — Grounded Answers

The AI system shall be instructed to generate answers based primarily on retrieved organizational knowledge.

The system should minimize unsupported claims and fabricated information.

### FR-AI-005 — Insufficient Information

If the system cannot retrieve sufficient relevant information, the system shall inform the user that the available knowledge base does not contain enough information to provide a reliable answer.

The system should not confidently invent information when relevant evidence is unavailable.

### FR-AI-006 — Source References

The system shall provide relevant source information with an AI-generated answer.

Source information should allow the user to understand which document(s) supported the answer.

### FR-AI-007 — Access-Controlled Retrieval

The system shall enforce authorization before retrieving document knowledge for an AI query.

A user must not receive AI-generated information derived from unauthorized documents.

---

## 12. Conversation Requirements

### FR-CONV-001 — Create Conversation

The system shall allow an authorized user to create an AI conversation.

### FR-CONV-002 — Conversation Context

A conversation shall belong to:

- A user
- An organization
- A relevant project or knowledge scope

### FR-CONV-003 — Save Messages

The system shall store user messages and AI responses associated with a conversation.

### FR-CONV-004 — Conversation Access

A user shall only be able to access conversations they are authorized to access.

---

## 13. High-Level End-to-End User Flows

### 13.1 New Organization Owner

1. User registers
2. Email verified
3. User logs in
4. Creates organization
5. Automatically becomes OWNER
6. Creates project
7. Invites team members
8. Uploads organizational documents
9. Documents processed asynchronously
10. Knowledge becomes READY
11. Team asks questions
12. AI retrieves relevant knowledge
13. AI generates grounded answer + sources

### 13.2 Invited New User

1. OWNER/ADMIN enters email
2. Selects MEMBER or ADMIN role
3. Invitation created
4. Invitation sent
5. Person opens invitation
6. Creates account if needed
7. Verifies email
8. Accepts invitation
9. Added to organization
10. Assigned pre-selected role
11. Can access authorized resources

### 13.3 Document Upload and Processing

1. Authorized user selects document
2. System validates file
3. System checks duplicate content
4. Valid and unique?
   - No → Reject with appropriate error
   - Yes → Continue
5. Store original document
6. Create document record
7. Status = QUEUED
8. Create background job
9. Worker processes document
10. Extract text
11. Chunk text
12. Generate embeddings
13. Store searchable knowledge
14. Status = READY

### 13.4 AI Question Flow

1. Authorized user asks question
2. Identify organization/project scope
3. Verify authorization
4. Convert question to embedding
5. Search authorized knowledge
6. Retrieve relevant chunks
7. Enough relevant information?
   - No → Return: "I could not find sufficient information."
   - Yes → Continue
8. Send question + context to LLM
9. Generate grounded answer
10. Return answer + source references

---

## 14. Important MVP Constraints

The following features are not included in the initial MVP:

- Image OCR
- Image understanding
- Automatic deletion of old documents
- Automatic AI decisions about which documents are valuable
- Full document versioning
- Custom user-defined roles
- Multiple simultaneous owners
- Complex document-level permission systems
- Automatic document merging
- Guaranteed zero AI hallucinations

These features may be considered in future versions.

---

## 15. Open Questions / Decisions to Finalize Later

The following items are intentionally not finalized yet:

- Maximum allowed file size
- Exact session/token authentication strategy
- Exact invitation expiration period
- Exact ADMIN permission matrix
- Whether users can create unlimited organizations
- Exact project deletion strategy: hard delete, soft delete, or archive
- Exact document deletion and retention strategy
- Exact document duplicate detection scope: organization-wide or project-wide
- Exact vector database/storage technology
- Exact LLM and embedding provider
- Exact object storage provider
- Exact cloud deployment platform
- Rate limiting rules
- AI answer evaluation metrics

These decisions will be made during the system architecture and technical design phases.

---

## 16. Definition of MVP Success

The MVP will be considered functionally successful when the following complete flow works:

A new user can register and verify their email, create an organization, become its owner, create a project, invite a team member with a predefined role, allow the member to join the organization, upload a supported non-duplicate document, process that document asynchronously into searchable knowledge, ask a question about the document, and receive a grounded AI-generated answer with source references while ensuring that users from another organization cannot access the organization's data or AI knowledge.

---

## 17. Core System Invariants

The following rules must always remain true:

- An organization has exactly one OWNER
- A user cannot access another organization's resources
- Authorization must be enforced on the server
- An invitation can only grant access to the intended email/user
- A user cannot become a duplicate member of the same organization
- Duplicate document content should not be unnecessarily stored
- Failed document processing must not be treated as ready knowledge
- Deleted document knowledge must not remain available for AI retrieval
- AI retrieval must respect organization and project boundaries
- The system should prefer admitting insufficient knowledge over confidently inventing an unsupported answer
