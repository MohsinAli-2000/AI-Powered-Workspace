import type { OrganizationRole } from '../organizations/organization.entity.js';
import type { ProjectRole } from '../projects/project.entity.js';

/**
 * Access rule effect defining whether access is granted or denied.
 * Maps to PostgreSQL enum `document_effect`.
 * Invariant: DENY takes precedence over ALLOW.
 */
export type DocumentEffect = 'ALLOW' | 'DENY';

/**
 * Direct user-level access rule.
 * Maps to PostgreSQL table `document_user_access`.
 */
export interface DocumentUserAccess {
  id: string;
  document_id: string;
  user_id: string;
  effect: DocumentEffect;
  created_at: Date;
  user_name?: string | null;
  user_email?: string;
}

/**
 * Group-level access rule.
 * Maps to PostgreSQL table `document_group_access`.
 */
export interface DocumentGroupAccess {
  id: string;
  document_id: string;
  group_id: string;
  effect: DocumentEffect;
  created_at: Date;
  group_name?: string;
}

/**
 * Organization role-level access rule.
 * Maps to PostgreSQL table `document_org_role_access`.
 */
export interface DocumentOrgRoleAccess {
  id: string;
  document_id: string;
  role: OrganizationRole;
  effect: DocumentEffect;
  created_at: Date;
}

/**
 * Project role-level access rule.
 * Maps to PostgreSQL table `document_project_role_access`.
 */
export interface DocumentProjectRoleAccess {
  id: string;
  document_id: string;
  role: ProjectRole;
  effect: DocumentEffect;
  created_at: Date;
}

/**
 * Aggregated representation of all access rules configured on a document.
 */
export interface DocumentAccessRulesSummary {
  document_id: string;
  access_mode: 'PROJECT' | 'RESTRICTED';
  user_rules: DocumentUserAccess[];
  group_rules: DocumentGroupAccess[];
  org_role_rules: DocumentOrgRoleAccess[];
  project_role_rules: DocumentProjectRoleAccess[];
}

/**
 * Result of the 6-step authorization pipeline evaluation.
 */
export interface AccessEvaluationResult {
  allowed: boolean;
  reason: string;
  matchedEffect?: DocumentEffect;
  ruleSource?: 'OWNER_BYPASS' | 'PROJECT_MODE' | 'USER' | 'GROUP' | 'PROJECT_ROLE' | 'ORG_ROLE' | 'DEFAULT_DENY';
}
