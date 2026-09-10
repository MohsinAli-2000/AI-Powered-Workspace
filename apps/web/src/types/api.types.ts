// Common API response envelope
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

// ---------------------------------------------------------------------------
// 1. Auth Types
// ---------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ---------------------------------------------------------------------------
// 2. Organization Types
// ---------------------------------------------------------------------------
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  role?: OrganizationRole;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
  user: {
    id: string;
    email: string;
    full_name: string;
  };
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED';

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  status: InvitationStatus;
  invited_by: string;
  created_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// 3. Project Types
// ---------------------------------------------------------------------------
export type ProjectRole = 'PROJECT_MANAGER' | 'PROJECT_MEMBER';

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: ProjectRole;
  document_count?: number;
  member_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  user: {
    id: string;
    email: string;
    full_name: string;
  };
}

// ---------------------------------------------------------------------------
// 4. Group Types
// ---------------------------------------------------------------------------
export interface Group {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    org_role?: OrganizationRole;
  };
}

// ---------------------------------------------------------------------------
// 5. Document & Access Control Types
// ---------------------------------------------------------------------------
export type DocumentAccessMode = 'PROJECT' | 'RESTRICTED';
export type DocumentEffect = 'ALLOW' | 'DENY';
export type DocumentVersionStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentItem {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  mime_type: string;
  access_mode: DocumentAccessMode;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_version_id?: string;
  version_number?: number;
  status?: DocumentVersionStatus;
  file_size?: number;
  processed_at?: string;
}

export interface DocumentUserRule {
  id: string;
  document_id: string;
  user_id: string;
  effect: DocumentEffect;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface DocumentGroupRule {
  id: string;
  document_id: string;
  group_id: string;
  effect: DocumentEffect;
  created_at: string;
  group?: {
    id: string;
    name: string;
  };
}

export interface DocumentOrgRoleRule {
  id: string;
  document_id: string;
  role: OrganizationRole;
  effect: DocumentEffect;
  created_at: string;
}

export interface DocumentProjectRoleRule {
  id: string;
  document_id: string;
  role: ProjectRole;
  effect: DocumentEffect;
  created_at: string;
}

export interface DocumentAccessRulesSummary {
  access_mode: DocumentAccessMode;
  user_rules: DocumentUserRule[];
  group_rules: DocumentGroupRule[];
  org_role_rules: DocumentOrgRoleRule[];
  project_role_rules: DocumentProjectRoleRule[];
}

// ---------------------------------------------------------------------------
// 6. Conversations & RAG Sources
// ---------------------------------------------------------------------------
export interface Conversation {
  id: string;
  organization_id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_ids?: string[];
}

export interface MessageSource {
  id: string;
  message_id: string;
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_version_id?: string;
  page_number?: number;
  chunk_index?: number;
  similarity: number;
  content_excerpt: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  created_at: string;
  sources?: MessageSource[];
}
