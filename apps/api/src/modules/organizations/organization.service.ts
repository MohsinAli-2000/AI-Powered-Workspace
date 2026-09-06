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
  OrganizationWithRole,
  OrganizationMemberDetail,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  TransferOwnershipInput,
} from './organization.entity.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/app-error.js';

export class OrganizationService {
  constructor(
    private readonly organizationRepo: OrganizationRepository = organizationRepository,
    private readonly membershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly userRepo: UserRepository = userRepository
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

    await this.organizationRepo.deleteById(organizationId);
  }
}

export const organizationService = new OrganizationService();
