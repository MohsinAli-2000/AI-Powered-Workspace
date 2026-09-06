export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
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

export interface OrganizationWithRole extends Organization {
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
