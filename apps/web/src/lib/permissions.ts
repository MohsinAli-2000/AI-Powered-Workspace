import type { OrganizationRole, ProjectRole } from '@/types/api.types';

/**
 * Single source of truth for "who can do what", used to explain restrictions in the UI.
 * These mirror the server-side rules (docs/architecture/authorization.md); the API remains the real gatekeeper.
 */

export interface RoleInfo {
  label: string;
  tagline: string;
  can: string[];
  cannot: string[];
}

export const ORG_ROLE_INFO: Record<OrganizationRole, RoleInfo> = {
  OWNER: {
    label: 'Owner',
    tagline: 'Full control of the organization',
    can: [
      'See and manage every project and document',
      'Invite people, change roles and remove members',
      'Create and manage groups',
      'View the audit log',
      'Rename, transfer or delete the organization',
    ],
    cannot: [],
  },
  ADMIN: {
    label: 'Admin',
    tagline: 'Manages people, but not every project',
    can: [
      'Invite people and change Member roles',
      'Create and manage groups',
      'View the audit log',
      'Rename the organization',
      'Create projects, and work in projects they belong to',
    ],
    cannot: [
      'See projects they were not added to',
      "Remove members or change another Admin's role",
      'Transfer or delete the organization',
    ],
  },
  MEMBER: {
    label: 'Member',
    tagline: 'Works in the projects they belong to',
    can: [
      'Upload, view and chat with documents in projects they belong to',
      'Create their own projects (and manage them)',
      'See the member and group lists',
    ],
    cannot: [
      'See projects they were not added to',
      'Invite people, change roles or view the audit log',
      'Create or edit groups',
    ],
  },
};

export const PROJECT_ROLE_INFO: Record<ProjectRole, RoleInfo> = {
  PROJECT_MANAGER: {
    label: 'Project Manager',
    tagline: 'Runs this project',
    can: [
      'Add and remove project members, and change their roles',
      'Upload documents, rename or delete them, and retry failed ones',
      'Restrict a document and choose who can see it',
      'Edit or delete the project',
    ],
    cannot: [],
  },
  PROJECT_MEMBER: {
    label: 'Project Member',
    tagline: 'Contributes to this project',
    can: [
      'Upload documents',
      'View, download and chat with the documents they are allowed to see',
    ],
    cannot: [
      'Add or remove project members',
      'Rename or delete documents',
      'Change who can see a document',
    ],
  },
};

export function orgRoleLabel(role?: OrganizationRole | null): string {
  return role ? ORG_ROLE_INFO[role].label : 'No role';
}

export function projectRoleLabel(role?: ProjectRole | null): string {
  return role ? PROJECT_ROLE_INFO[role].label : 'Not a member';
}

/** What an organization role may do across the organization. */
export function orgCapabilities(role?: OrganizationRole | null) {
  const isOwner = role === 'OWNER';
  const isAdminOrOwner = isOwner || role === 'ADMIN';
  return {
    isOwner,
    isAdminOrOwner,
    canInvite: isAdminOrOwner,
    canManageGroups: isAdminOrOwner,
    canViewAudit: isAdminOrOwner,
    canEditOrg: isAdminOrOwner,
    canRemoveMembers: isOwner,
    canDeleteOrg: isOwner,
    /** Only the OWNER implicitly has access to every project; Admins need project membership. */
    hasAllProjectAccess: isOwner,
  };
}

/** What a user may do inside one project, given both of their roles. */
export function projectCapabilities(
  orgRole?: OrganizationRole | null,
  projectRole?: ProjectRole | null
) {
  const isOwner = orgRole === 'OWNER';
  const isMember = Boolean(projectRole) || isOwner;
  const isManager = projectRole === 'PROJECT_MANAGER' || isOwner;
  return {
    isMember,
    isManager,
    canUpload: isMember,
    canManageMembers: isManager,
    canManageDocuments: isManager,
  };
}

/** One-line description of how someone with this role gets access to documents. */
export function accessExplanation(orgRole?: OrganizationRole | null): string {
  if (orgRole === 'OWNER') {
    return 'As the Owner you can see every project and every document in this organization.';
  }
  return 'You can only see the projects you have been added to. Inside a project you see every document except those that are restricted and not shared with you.';
}
