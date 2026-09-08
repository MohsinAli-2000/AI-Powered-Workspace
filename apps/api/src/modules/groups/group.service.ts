import {
  groupRepository,
  type GroupRepository,
} from './group.repository.js';
import {
  groupMembershipRepository,
  type GroupMembershipRepository,
} from './group-membership.repository.js';
import {
  organizationRepository,
  type OrganizationRepository,
} from '../organizations/organization.repository.js';
import {
  organizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../organizations/organization-membership.repository.js';
import {
  userRepository,
  type UserRepository,
} from '../users/user.repository.js';
import type {
  Group,
  GroupMembership,
  GroupWithMeta,
  GroupMemberDetail,
} from './group.entity.js';
import type {
  CreateGroupInput,
  UpdateGroupInput,
} from './group.schema.js';
import type { OrganizationRole } from '../organizations/organization.entity.js';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../../errors/app-error.js';

export class GroupService {
  constructor(
    private readonly groupRepo: GroupRepository = groupRepository,
    private readonly groupMembershipRepo: GroupMembershipRepository = groupMembershipRepository,
    private readonly organizationRepo: OrganizationRepository = organizationRepository,
    private readonly organizationMembershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly userRepo: UserRepository = userRepository
  ) {}

  /**
   * Creates a new group inside an organization.
   * Enforces unique group name per organization.
   */
  public async createGroup(
    organizationId: string,
    creatorUserId: string,
    input: CreateGroupInput
  ): Promise<GroupWithMeta> {
    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    // Verify creator org membership
    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      creatorUserId,
      organizationId
    );
    if (!orgMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    // Check for duplicate group name in the organization (case-insensitive)
    const existingGroup = await this.groupRepo.findByNameAndOrg(input.name, organizationId);
    if (existingGroup) {
      throw new ConflictError('A group with this name already exists in this organization.');
    }

    const createdGroup = await this.groupRepo.create({
      organization_id: organizationId,
      name: input.name,
      description: input.description,
      created_by: creatorUserId,
    });

    return {
      ...createdGroup,
      member_count: 0,
      is_member: false,
    };
  }

  /**
   * Lists all groups in an organization with member count and membership flags.
   */
  public async listOrganizationGroups(
    organizationId: string,
    requestingUserId: string
  ): Promise<GroupWithMeta[]> {
    return this.groupRepo.listByOrganization(organizationId, requestingUserId);
  }

  /**
   * Retrieves single group details with member count and membership status.
   */
  public async getGroup(
    groupId: string,
    requestingUserId: string
  ): Promise<GroupWithMeta> {
    const group = await this.groupRepo.getWithMetaById(groupId, requestingUserId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }
    return group;
  }

  /**
   * Updates a group's name and/or description.
   * Validates name uniqueness within the parent organization.
   */
  public async updateGroup(
    groupId: string,
    input: UpdateGroupInput
  ): Promise<Group> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }

    if (input.name !== undefined) {
      const existing = await this.groupRepo.findByNameAndOrg(input.name, group.organization_id);
      if (existing && existing.id !== groupId) {
        throw new ConflictError('A group with this name already exists in this organization.');
      }
    }

    const updated = await this.groupRepo.update(groupId, input);
    if (!updated) {
      throw new NotFoundError('Group not found.');
    }

    return updated;
  }

  /**
   * Deletes a group and cascades its memberships.
   */
  public async deleteGroup(groupId: string): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }

    await this.groupRepo.delete(groupId);
  }

  /**
   * Lists all members in a group.
   */
  public async listGroupMembers(groupId: string): Promise<GroupMemberDetail[]> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }

    return this.groupMembershipRepo.findGroupMembers(groupId);
  }

  /**
   * Adds an organization member to a group.
   * Enforces cross-tenant isolation and duplicate membership prevention.
   */
  public async addGroupMember(
    groupId: string,
    targetUserId: string
  ): Promise<GroupMembership> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }

    // 1. Verify target user exists
    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User not found.');
    }

    // 2. Strict Cross-Tenant Check: Target user MUST be an active organization member
    const orgMembership = await this.organizationMembershipRepo.findByUserAndOrg(
      targetUserId,
      group.organization_id
    );
    if (!orgMembership) {
      throw new BadRequestError(
        'User must be an active member of this organization to join the group.'
      );
    }

    // 3. Duplicate Prevention
    const existingMembership = await this.groupMembershipRepo.findByUserAndGroup(
      targetUserId,
      groupId
    );
    if (existingMembership) {
      throw new ConflictError('User is already a member of this group.');
    }

    return this.groupMembershipRepo.create({
      organization_id: group.organization_id,
      group_id: groupId,
      user_id: targetUserId,
    });
  }

  /**
   * Removes a member from a group.
   * Supports administrative removal by OWNER/ADMIN or self-removal by the member.
   */
  public async removeGroupMember(
    groupId: string,
    targetUserId: string,
    requestingUserId: string,
    requestingOrgRole: OrganizationRole
  ): Promise<void> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found.');
    }

    const isSelfRemoval = requestingUserId === targetUserId;
    const isOrgAdmin = requestingOrgRole === 'OWNER' || requestingOrgRole === 'ADMIN';

    if (!isSelfRemoval && !isOrgAdmin) {
      throw new ForbiddenError(
        'Insufficient permissions. Only organization OWNER or ADMIN can remove other members from this group.'
      );
    }

    const existingMembership = await this.groupMembershipRepo.findByUserAndGroup(
      targetUserId,
      groupId
    );
    if (!existingMembership) {
      throw new NotFoundError('Group membership not found.');
    }

    await this.groupMembershipRepo.deleteByUserAndGroup(targetUserId, groupId);
  }
}

export const groupService = new GroupService();
