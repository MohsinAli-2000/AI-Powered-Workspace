export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** Set by platform admins. A SUSPENDED organization keeps its data but no member can use it. */
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

export interface Organization {
  id: string;
  name: string;
  status: OrganizationStatus;
  suspended_at: Date | null;
  suspended_by: string | null;
  suspension_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: Date;
}

export interface OrganizationWithRole
  extends Omit<Organization, 'suspended_by'> {
  user_role: OrganizationRole;
  member_count?: number;
}

export interface OrganizationMemberDetail {
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  role: OrganizationRole;
  joined_at: Date;
}

export interface CreateOrganizationInput {
  name: string;
}

export interface UpdateOrganizationInput {
  name: string;
}

export interface TransferOwnershipInput {
  newOwnerUserId: string;
}
