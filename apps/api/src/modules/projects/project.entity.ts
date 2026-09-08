/**
 * Role assigned to a member within a project boundary.
 * Maps to the PostgreSQL enum `project_role`.
 */
export type ProjectRole = 'PROJECT_MANAGER' | 'PROJECT_MEMBER';

/**
 * Database row shape for the `projects` table.
 */
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row shape for the `project_memberships` table.
 */
export interface ProjectMembership {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: Date;
  updated_at: Date;
}

/**
 * Enriched project representation returned to API consumers.
 * Includes the requesting user's project role and total member count.
 */
export interface ProjectWithMembership extends Project {
  user_role?: ProjectRole | null;
  member_count: number;
}

/**
 * Enriched project member view including basic user information.
 */
export interface ProjectMemberDetail {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  name: string;
  email: string;
  created_at: Date;
}
