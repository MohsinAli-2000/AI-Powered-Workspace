import type { OrganizationRole } from '../organizations/organization.entity.js';

/**
 * Database row shape for the `groups` table.
 */
export interface Group {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Database row shape for the `group_memberships` table.
 */
export interface GroupMembership {
  id: string;
  organization_id: string;
  group_id: string;
  user_id: string;
  created_at: Date;
}

/**
 * Enriched group representation returned to API consumers.
 * Includes the total member count and optionally whether the requesting user is a member.
 */
export interface GroupWithMeta extends Group {
  member_count: number;
  is_member?: boolean;
}

/**
 * Enriched group member view including user profile and organization role.
 */
export interface GroupMemberDetail {
  id: string;
  group_id: string;
  user_id: string;
  name: string;
  email: string;
  org_role: OrganizationRole;
  joined_at: Date;
}
