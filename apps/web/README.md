# AI Powered Workspace — Web Frontend

> Modern, responsive Next.js 16+ web application for the multi-tenant AI Knowledge Platform.

---

## 📌 Overview

`apps/web` provides the user-facing web interface for the AI Powered Workspace platform. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, and Zustand, it features a curated dark-mode aesthetic with glassmorphism, glowing micro-accents, and real-time interactive capabilities.

---

## ✨ Features & Pages

### 1. Authentication & Onboarding
- **Sign In (`/login`)**: Email and password authentication with automatic redirect to requested resources.
- **Sign Up (`/register`)**: Account creation with instant email verification dispatch.
- **Email Verification (`/verify-email`)**: Automated token verification and one-click token resend.
- **Password Recovery (`/forgot-password`, `/reset-password`)**: Self-service password reset flows with token validation.
- **Accept Invitation (`/invitations/accept`)**: Deep-linked organization invite acceptance for existing and new users.

### 2. Workspace & Context Management
- **Organization Switcher (`OrgSwitcher`)**: Multi-tenant navigation allowing seamless switching between organizations and creation of new tenants.
- **Contextual Access Cards (`YourAccessCard`)**: Transparent overview of the current user's role and permission privileges in the active context.
- **Dashboard (`/dashboard`)**: Organization overview with quick stats and access to projects and knowledge.
- **Help Center (`/help`)**: Interactive documentation, RAG search explanation, role permission matrix, FAQ, and keyboard shortcuts.

### 3. Project & Document Knowledge Hub
- **Project Directory (`/projects`)**: List and manage departmental project spaces.
- **Project Hub (`/projects/[projectId]`)**:
  - **Drag-and-Drop Uploader (`DocumentUploadZone`)**: 50MB file size validation, supported file format checks (PDF, DOCX, XLSX, TXT, PPTX), and duplicate content detection.
  - **Document Table (`DocumentTable`)**: Status badges (`QUEUED`, `PROCESSING`, `READY`, `FAILED`), automatic 3-second polling for active jobs, document download links, and deletion.
  - **Granular Access Control (`AccessRulesDialog`)**: Configure `PROJECT` vs. `RESTRICTED` document access with individual user, group, organization role, and project role `ALLOW` and `DENY` rules (with strict `DENY` precedence).

### 4. AI Assistant & Conversational Interface
- **Chat Interface (`ChatView`)**:
  - Conversational message bubbles with rich markdown rendering (`react-markdown` + `remark-gfm`).
  - Project scope filtering ("All Accessible Projects" vs. specific project boundaries).
  - Server-Sent Events (SSE) token streaming for real-time generative responses.
  - `FR-AI-005` Insufficient Information warning callouts when documents lack supporting evidence.
  - Interactive citation pills (`[1]`, `[2]`) with cosine similarity confidence percentages.
  - Off-canvas **Source Citation Drawer (`SourceCitationDrawer`)** revealing document title, chunk index, page number, confidence meter, and exact grounded chunk excerpts.

### 5. Organization Administration & Settings
- **Organization Settings (`/settings/organization`)**: Organization renaming, ownership transfer, and organization deletion.
- **Member Directory (`/settings/members`)**: Member roster, role assignment (`ADMIN` / `MEMBER`), and member removal with admin minimum count rules.
- **Invitations Manager (`/settings/invitations`)**: Pending invitation tracking and revocation.
- **Group Management (`/settings/groups`)**: Create groups, assign members, and manage bulk document permissions.
- **Audit Log Inspector (`/settings/audit-logs`)**: Search, filter by action/resource/actor, pagination, and JSON metadata inspector.
- **Account Settings (`/settings/account`)**: User profile management and credential updates.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16+ (App Router) |
| **Language** | TypeScript (Strict Mode) |
| **Styling** | Tailwind CSS v4 + Vanilla CSS Design Tokens |
| **State Management** | Zustand (`auth.store.ts`, `org.store.ts`, `ui.store.ts`) |
| **Data Fetching** | Fetch API with automatic 401 JWT refresh mutex queue (`api-client.ts`) |
| **Markdown Rendering** | `react-markdown`, `remark-gfm` |
| **Icons** | `lucide-react` |

---

## 📁 Directory Structure

```text
apps/web/src/
├── app/
│   ├── (auth)/                # Auth routes (login, register, reset, invitations)
│   ├── (dashboard)/           # Protected workspace routes (dashboard, projects, settings, help)
│   ├── globals.css            # Dark mode tokens, glassmorphism, glowing micro-accents
│   └── layout.tsx             # Root layout with Toast notification provider
├── components/
│   ├── access/                # Access cards & badges (YourAccessCard)
│   ├── chat/                  # AI Assistant (ChatView, Bubbles, CitationDrawer)
│   ├── documents/             # UploadZone, DocumentTable, AccessRulesDialog
│   ├── layout/                # Navbar, Sidebar, OrgSwitcher, UserMenu, VerificationBanner
│   └── ui/                    # Reusable primitives (Modal, ConfirmDialog, Select, Input, Notice, State)
├── hooks/                     # Custom React hooks (useOrgData, etc.)
├── lib/                       # API client, permission guards, normalization, utilities
├── stores/                    # Zustand state stores (auth, org, ui)
└── types/                     # TypeScript type definitions & API contracts
```

---

## ⚙️ Environment Variables

Create a `.env.local` file in `apps/web`:

```env
# URL of the Core Node.js API
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

---

## 🚀 Running Locally

```bash
# Install dependencies from root or within apps/web
npm install

# Start development server
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

```bash
# Build production bundle
npm run build

# Start production server
npm start
```
