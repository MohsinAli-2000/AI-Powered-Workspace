import { BaseRepository } from '../../db/base.repository.js';
import {
  organizationRepository,
  type OrganizationRepository,
} from './organization.repository.js';
import {
  organizationMembershipRepository,
  type OrganizationMembershipRepository,
} from './organization-membership.repository.js';
import { userRepository, type UserRepository } from '../users/user.repository.js';
import type {
  Organization,
  OrganizationRole,
  OrganizationWithRole,
  OrganizationMemberDetail,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  TransferOwnershipInput,
} from './organization.entity.js';
import { auditService, type AuditService } from '../audit/audit.service.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/app-error.js';

export class OrganizationService {
  constructor(
    private readonly organizationRepo: OrganizationRepository = organizationRepository,
    private readonly membershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly userRepo: UserRepository = userRepository,
    private readonly audit: AuditService = auditService
  ) {}

  /**
   * Creates a new organization and establishes the creator as the sole OWNER.
   * Runs atomically inside a database transaction (FR-ORG-001, FR-ORG-002, FR-ORG-003).
   */
  public async createOrganization(
    creatorUserId: string,
    input: CreateOrganizationInput
  ): Promise<OrganizationWithRole> {
    const creatorUser = await this.userRepo.findById(creatorUserId);
    if (!creatorUser) {
      throw new NotFoundError('Creator user account not found.');
    }

    return BaseRepository.withTransaction(async (transactionClient) => {
      // 1. Create organization record
      const newlyCreatedOrg = await this.organizationRepo.create(
        { name: input.name },
        transactionClient
      );

      // 2. Automatically assign creator as the OWNER
      await this.membershipRepo.create(
        {
          organization_id: newlyCreatedOrg.id,
          user_id: creatorUserId,
          role: 'OWNER',
        },
        transactionClient
      );

      // 3. Record audit event
      await this.audit.record(
        {
          organizationId: newlyCreatedOrg.id,
          actorUserId: creatorUserId,
          action: 'organization.created',
          resourceType: 'organization',
          resourceId: newlyCreatedOrg.id,
          metadata: { name: newlyCreatedOrg.name },
        },
        transactionClient
      );

      return {
        ...newlyCreatedOrg,
        user_role: 'OWNER',
        member_count: 1,
      };
    });
  }

  /**
   * Retrieves all organizations in which the specified user holds an active membership (FR-ORG-004).
   */
  public async getUserOrganizations(userId: string): Promise<OrganizationWithRole[]> {
    return this.organizationRepo.findUserOrganizations(userId);
  }

  /**
   * Retrieves organization details, ensuring the caller is a member (FR-ORG-005).
   */
  public async getOrganizationDetails(
    organizationId: string,
    userId: string
  ): Promise<OrganizationWithRole> {
    const membership = await this.membershipRepo.findByUserAndOrg(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    const memberCount = await this.organizationRepo.getMemberCount(organizationId);

    return {
      ...organization,
      user_role: membership.role,
      member_count: memberCount,
    };
  }

  /**
   * Lists all members of an organization. Accessible to any member of the organization.
   */
  public async getOrganizationMembers(
    organizationId: string,
    userId: string
  ): Promise<OrganizationMemberDetail[]> {
    const membership = await this.membershipRepo.findByUserAndOrg(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError('You do not have access to view members of this organization.');
    }

    return this.membershipRepo.findMembersByOrg(organizationId);
  }

  /**
   * Updates organization settings. Allowed for OWNER and ADMIN roles (FR-ORG-006).
   */
  public async updateOrganization(
    organizationId: string,
    userId: string,
    input: UpdateOrganizationInput
  ): Promise<Organization> {
    const membership = await this.membershipRepo.findByUserAndOrg(userId, organizationId);
    if (!membership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenError(
        'Insufficient permissions. Only organization OWNER or ADMIN can update organization settings.'
      );
    }

    const updatedOrg = await this.organizationRepo.updateName(organizationId, input.name);
    if (!updatedOrg) {
      throw new NotFoundError('Organization not found.');
    }

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'organization.updated',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { newName: input.name },
    });

    return updatedOrg;
  }

  /**
   * Transfers organization ownership to another existing organization member (FR-ORG-007).
   * Enforces that the organization always retains exactly one OWNER.
   * The previous owner is transitioned to ADMIN.
   */
  public async transferOwnership(
    organizationId: string,
    currentOwnerId: string,
    input: TransferOwnershipInput
  ): Promise<OrganizationWithRole> {
    // Check current owner
    const currentMembership = await this.membershipRepo.findByUserAndOrg(
      currentOwnerId,
      organizationId
    );

    if (!currentMembership || currentMembership.role !== 'OWNER') {
      throw new ForbiddenError('Only the organization OWNER can transfer ownership.');
    }

    // Cannot transfer to self
    if (input.newOwnerUserId === currentOwnerId) {
      throw new BadRequestError('You are already the OWNER of this organization.');
    }

    // Check target user membership
    const targetMembership = await this.membershipRepo.findByUserAndOrg(
      input.newOwnerUserId,
      organizationId
    );

    if (!targetMembership) {
      throw new BadRequestError(
        'The target user must already be an active member of the organization before receiving ownership.'
      );
    }

    return BaseRepository.withTransaction(async (transactionClient) => {
      // 1. Demote current owner to ADMIN
      await this.membershipRepo.updateRole(
        currentMembership.id,
        'ADMIN',
        transactionClient
      );

      // 2. Promote target member to OWNER
      await this.membershipRepo.updateRole(
        targetMembership.id,
        'OWNER',
        transactionClient
      );

      // 3. Record audit event
      await this.audit.record(
        {
          organizationId,
          actorUserId: currentOwnerId,
          action: 'organization.ownership_transferred',
          resourceType: 'organization',
          resourceId: organizationId,
          metadata: { previousOwnerId: currentOwnerId, newOwnerId: input.newOwnerUserId },
        },
        transactionClient
      );

      const organization = await this.organizationRepo.findById(
        organizationId,
        transactionClient
      );

      if (!organization) {
        throw new NotFoundError('Organization not found.');
      }

      const memberCount = await this.organizationRepo.getMemberCount(
        organizationId,
        transactionClient
      );

      return {
        ...organization,
        user_role: 'ADMIN', // Caller's new role
        member_count: memberCount,
      };
    });
  }

  /**
   * Deletes an organization and all associated resources (FR-ORG-009).
   * Only the current OWNER can delete the organization.
   */
  public async deleteOrganization(
    organizationId: string,
    userId: string
  ): Promise<void> {
    const membership = await this.membershipRepo.findByUserAndOrg(userId, organizationId);
    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenError('Only the organization OWNER can delete the organization.');
    }

    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'organization.deleted',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { name: organization.name },
    });

    await this.organizationRepo.deleteById(organizationId);
  }

  /**
   * Removes a member from the organization (FR-MEMBER-010).
   *
   * MVP restriction: Only the OWNER can remove members.
   *
   * Enforces:
   * - FR-MEMBER-010: OWNER-only removal
   * - FR-MEMBER-012: OWNER cannot be removed
   * - DEC-017: ADMIN minimum count rule
   * - DEC-019: Removal does not delete the user account
   */
  public async removeMember(
    organizationId: string,
    targetUserId: string,
    actingUserId: string
  ): Promise<void> {
    // Verify acting user is the OWNER (MVP: OWNER-only for removal)
    const actingMembership = await this.membershipRepo.findByUserAndOrg(
      actingUserId,
      organizationId
    );
    if (!actingMembership || actingMembership.role !== 'OWNER') {
      throw new ForbiddenError('Only the organization OWNER can remove members.');
    }

    // Find the target member
    const targetMembership = await this.membershipRepo.findByUserAndOrg(
      targetUserId,
      organizationId
    );
    if (!targetMembership) {
      throw new NotFoundError('Member not found in this organization.');
    }

    // FR-MEMBER-012: Prevent removing the OWNER
    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenError(
        'The OWNER cannot be removed. Transfer ownership to another member first.'
      );
    }

    // Prevent OWNER from removing themselves (they must transfer ownership first)
    if (targetUserId === actingUserId) {
      throw new BadRequestError(
        'The OWNER cannot leave the organization without transferring ownership first.'
      );
    }

    // DEC-017: ADMIN minimum count enforcement
    if (targetMembership.role === 'ADMIN') {
      const adminCount = await this.membershipRepo.countByRole(organizationId, 'ADMIN');
      if (adminCount <= 1) {
        throw new BadRequestError(
          'Cannot remove the last ADMIN. Promote another member to ADMIN first.'
        );
      }
    }

    // DEC-019: Only remove membership — do NOT delete the user account
    await this.membershipRepo.deleteByUserAndOrg(targetUserId, organizationId);

    await this.audit.record({
      organizationId,
      actorUserId: actingUserId,
      action: 'member.removed',
      resourceType: 'member',
      resourceId: targetUserId,
      metadata: { removedRole: targetMembership.role },
    });
  }

  /**
   * Updates a member's organization role (FR-MEMBER-011).
   *
   * Enforces:
   * - FR-MEMBER-011: Authorized role changes
   * - FR-MEMBER-012: OWNER role protection (cannot assign or change OWNER via this endpoint)
   * - DEC-017: ADMIN minimum count rule (prevents demoting the last ADMIN)
   */
  public async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    newRole: OrganizationRole,
    actingUserId: string
  ): Promise<OrganizationMemberDetail> {
    // Defense-in-depth: reject OWNER role assignment (schema also enforces this)
    if (newRole === 'OWNER') {
      throw new BadRequestError(
        'OWNER role can only be assigned through the ownership transfer process.'
      );
    }

    // Verify acting user's membership and role
    const actingMembership = await this.membershipRepo.findByUserAndOrg(
      actingUserId,
      organizationId
    );
    if (!actingMembership) {
      throw new ForbiddenError('You do not have access to this organization.');
    }
    if (actingMembership.role !== 'OWNER' && actingMembership.role !== 'ADMIN') {
      throw new ForbiddenError(
        'Insufficient permissions. Only OWNER or ADMIN can change member roles.'
      );
    }

    // Find target member
    const targetMembership = await this.membershipRepo.findByUserAndOrg(
      targetUserId,
      organizationId
    );
    if (!targetMembership) {
      throw new NotFoundError('Member not found in this organization.');
    }

    // FR-MEMBER-012: Prevent changing the OWNER's role
    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenError(
        'The OWNER role cannot be changed directly. Use the ownership transfer process.'
      );
    }

    // Same role check
    if (targetMembership.role === newRole) {
      throw new BadRequestError('The member already has the specified role.');
    }

    // ADMIN cannot change another ADMIN's role — only OWNER can
    if (actingMembership.role === 'ADMIN' && targetMembership.role === 'ADMIN') {
      throw new ForbiddenError("Only the OWNER can change an ADMIN's role.");
    }

    // DEC-017: ADMIN minimum count — prevent demoting the last ADMIN
    if (targetMembership.role === 'ADMIN' && newRole === 'MEMBER') {
      const adminCount = await this.membershipRepo.countByRole(organizationId, 'ADMIN');
      if (adminCount <= 1) {
        throw new BadRequestError(
          'Cannot demote the last ADMIN. Promote another member to ADMIN first.'
        );
      }
    }

    // Update the role
    await this.membershipRepo.updateRole(targetMembership.id, newRole);

    await this.audit.record({
      organizationId,
      actorUserId: actingUserId,
      action: 'member.role_updated',
      resourceType: 'member',
      resourceId: targetUserId,
      metadata: { previousRole: targetMembership.role, newRole },
    });

    // Return the updated member detail by fetching the user info
    const targetUser = await this.userRepo.findById(targetUserId);
    return {
      membership_id: targetMembership.id,
      user_id: targetUserId,
      name: targetUser?.name ?? '',
      email: targetUser?.email ?? '',
      role: newRole,
      joined_at: targetMembership.created_at,
    };
  }
}

export const organizationService = new OrganizationService();
