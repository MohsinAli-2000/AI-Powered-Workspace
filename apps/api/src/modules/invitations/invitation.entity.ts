import type { OrganizationRole } from '../organizations/organization.entity.js';

/**
 * Tracks the lifecycle state of an invitation.
 *
 * PENDING  → Invitation created, waiting for recipient action
 * ACCEPTED → Recipient accepted, membership created
 * REJECTED → Recipient explicitly declined
 * REVOKED  → Inviter/admin cancelled the invitation
 * EXPIRED  → Invitation passed its expiration timestamp (derived, not DB-set)
 */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

/**
 * Roles that can be assigned through the invitation flow.
 * OWNER is intentionally excluded — ownership changes only via the transfer process (FR-MEMBER-012).
 */
export type InvitableRole = Exclude<OrganizationRole, 'OWNER'>;

/**
 * Database row shape for the `invitations` table.
 */
export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  invited_by: string;
  token_hash: string;
  status: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
  token?: string;
}

/**
 * Enriched invitation view with inviter and organization details, used in list endpoints.
 */
export interface InvitationDetail extends Invitation {
  organization_name: string;
  inviter_name: string;
  inviter_email: string;
}

/**
 * Client-facing input for creating a new invitation.
 */
export interface CreateInvitationInput {
  email: string;
  role: InvitableRole;
}
