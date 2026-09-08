import { BaseRepository } from '../../db/base.repository.js';
import {
  invitationRepository,
  type InvitationRepository,
} from './invitation.repository.js';
import {
  organizationRepository,
  type OrganizationRepository,
} from '../organizations/organization.repository.js';
import {
  organizationMembershipRepository,
  type OrganizationMembershipRepository,
} from '../organizations/organization-membership.repository.js';
import { userRepository, type UserRepository } from '../users/user.repository.js';
import { emailService, type EmailService } from '../email/email.service.js';
import {
  generateInvitationToken,
  verifyInvitationToken,
} from '../../utils/jwt.js';
import { hashToken } from '../../utils/crypto.js';
import type {
  Invitation,
  InvitationDetail,
  CreateInvitationInput,
} from './invitation.entity.js';
import type { OrganizationMembership } from '../organizations/organization.entity.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/app-error.js';

/** Number of days before an invitation expires. */
const INVITATION_EXPIRY_DAYS = 7;

export class InvitationService {
  constructor(
    private readonly invitationRepo: InvitationRepository = invitationRepository,
    private readonly organizationRepo: OrganizationRepository = organizationRepository,
    private readonly membershipRepo: OrganizationMembershipRepository = organizationMembershipRepository,
    private readonly userRepo: UserRepository = userRepository,
    private readonly mailer: EmailService = emailService
  ) {}

  /**
   * Creates a new organization invitation and dispatches an invitation email.
   *
   * Enforces:
   * - FR-MEMBER-001: Authorized user can invite
   * - FR-MEMBER-002: Role is assigned before sending
   * - FR-MEMBER-003: Prevent inviting existing members
   * - FR-MEMBER-004: Prevent duplicate active invitations
   * - FR-MEMBER-005: Send invitation email
   * - FR-MEMBER-012: OWNER role cannot be assigned via invitation
   */
  public async createInvitation(
    organizationId: string,
    inviterId: string,
    input: CreateInvitationInput
  ): Promise<Invitation> {
    // Defense-in-depth: OWNER role rejection (also enforced at schema level)
    if ((input.role as string) === 'OWNER') {
      throw new BadRequestError(
        'OWNER role cannot be assigned through invitations. Use the ownership transfer process.'
      );
    }

    // Fetch inviter details for the email
    const inviter = await this.userRepo.findById(inviterId);
    if (!inviter) {
      throw new NotFoundError('Inviter user account not found.');
    }

    // Fetch organization details for the email
    const organization = await this.organizationRepo.findById(organizationId);
    if (!organization) {
      throw new NotFoundError('Organization not found.');
    }

    // Prevent self-invitation
    if (inviter.email.toLowerCase() === input.email.toLowerCase()) {
      throw new BadRequestError('You cannot invite yourself to the organization.');
    }

    // FR-MEMBER-003: Check if the email already belongs to an existing org member
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await this.membershipRepo.findByUserAndOrg(
        existingUser.id,
        organizationId
      );
      if (existingMembership) {
        throw new ConflictError('This user is already a member of the organization.');
      }
    }

    // FR-MEMBER-004: Prevent duplicate active invitations for same email + org
    const existingActiveInvitation = await this.invitationRepo.findActiveByEmailAndOrg(
      input.email,
      organizationId
    );
    if (existingActiveInvitation) {
      throw new ConflictError(
        'An active invitation already exists for this email address in this organization.'
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Create the invitation record first to obtain the ID
    // Use a placeholder token_hash; we'll update it after generating the JWT (which needs the ID)
    const placeholderHash = 'pending';

    const createdInvitation = await this.invitationRepo.create({
      organization_id: organizationId,
      email: input.email.toLowerCase(),
      role: input.role,
      invited_by: inviterId,
      token_hash: placeholderHash,
      status: 'PENDING',
      expires_at: expiresAt,
    });

    // Generate the JWT token embedding the invitation ID
    const rawInvitationToken = generateInvitationToken(
      createdInvitation.id,
      input.email.toLowerCase(),
      organizationId
    );

    // Hash the token and update the record
    const tokenHash = hashToken(rawInvitationToken);
    const updatedInvitation = await this.invitationRepo.updateTokenHash(
      createdInvitation.id,
      tokenHash
    );

    // FR-MEMBER-005: Dispatch invitation email
    await this.mailer.sendOrganizationInvitationEmail({
      recipientEmail: input.email,
      organizationName: organization.name,
      inviterName: inviter.name,
      assignedRole: input.role,
      invitationToken: rawInvitationToken,
    });

    const result = updatedInvitation ?? createdInvitation;
    return {
      ...result,
      token: rawInvitationToken,
    };
  }

  /**
   * Lists all invitations for an organization with inviter details.
   * Marks expired PENDING invitations as EXPIRED in the response.
   */
  public async listOrganizationInvitations(
    organizationId: string
  ): Promise<InvitationDetail[]> {
    const invitations = await this.invitationRepo.findByOrganization(organizationId);

    // Compute effective status: mark expired PENDING invitations
    const now = new Date();
    return invitations.map((invitation) => {
      if (invitation.status === 'PENDING' && new Date(invitation.expires_at) <= now) {
        return { ...invitation, status: 'EXPIRED' };
      }
      return invitation;
    });
  }

  /**
   * Revokes a pending invitation. Only OWNER or ADMIN can revoke.
   */
  public async revokeInvitation(
    organizationId: string,
    invitationId: string
  ): Promise<Invitation> {
    const invitation = await this.invitationRepo.findByIdAndOrg(invitationId, organizationId);
    if (!invitation) {
      throw new NotFoundError('Invitation not found in this organization.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestError(
        `Cannot revoke an invitation that is already ${invitation.status.toLowerCase()}.`
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) <= new Date()) {
      throw new BadRequestError('Cannot revoke an invitation that has already expired.');
    }

    const revokedInvitation = await this.invitationRepo.updateStatus(invitationId, 'REVOKED');
    if (!revokedInvitation) {
      throw new NotFoundError('Invitation not found.');
    }

    return revokedInvitation;
  }

  /**
   * Accepts an organization invitation for the authenticated user.
   *
   * Enforces:
   * - FR-MEMBER-006: Accept flow
   * - FR-MEMBER-007: Existing user must authenticate first
   * - FR-MEMBER-003: Prevent duplicate membership
   * - FR-MEMBER-009: Assign the role from the invitation
   * - Core invariant: Invitation email must match authenticated user email
   */
  public async acceptInvitation(
    rawToken: string,
    authenticatedUserId: string,
    authenticatedUserEmail: string
  ): Promise<OrganizationMembership> {
    // Verify the JWT and extract payload
    const tokenPayload = verifyInvitationToken(rawToken);
    const tokenHash = hashToken(rawToken);

    // Look up the invitation by token hash
    const invitation = await this.invitationRepo.findByTokenHash(tokenHash);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has been invalidated.');
    }

    // Validate invitation state
    this.validateInvitationIsActionable(invitation);

    // FR-MEMBER-007 / core invariant: Verify that the authenticated user's email
    // matches the invitation email to prevent token theft
    if (authenticatedUserEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError(
        'This invitation was sent to a different email address. You can only accept invitations addressed to your registered email.'
      );
    }

    // Verify the organization still exists
    const organization = await this.organizationRepo.findById(invitation.organization_id);
    if (!organization) {
      throw new NotFoundError('The organization associated with this invitation no longer exists.');
    }

    // FR-MEMBER-003: Prevent duplicate membership
    const existingMembership = await this.membershipRepo.findByUserAndOrg(
      authenticatedUserId,
      invitation.organization_id
    );
    if (existingMembership) {
      throw new ConflictError('You are already a member of this organization.');
    }

    // FR-MEMBER-009: Execute atomically — accept invitation + create membership
    return BaseRepository.withTransaction(async (transactionClient) => {
      // 1. Update invitation status to ACCEPTED
      await this.invitationRepo.updateStatus(invitation.id, 'ACCEPTED', transactionClient);

      // 2. Create organization membership with the role from the invitation
      const newMembership = await this.membershipRepo.create(
        {
          organization_id: invitation.organization_id,
          user_id: authenticatedUserId,
          role: invitation.role,
        },
        transactionClient
      );

      return newMembership;
    });
  }

  /**
   * Rejects an organization invitation for the authenticated user.
   */
  public async rejectInvitation(
    rawToken: string,
    authenticatedUserId: string,
    authenticatedUserEmail: string
  ): Promise<Invitation> {
    // Verify the JWT
    verifyInvitationToken(rawToken);
    const tokenHash = hashToken(rawToken);

    // Look up the invitation
    const invitation = await this.invitationRepo.findByTokenHash(tokenHash);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has been invalidated.');
    }

    // Validate state
    this.validateInvitationIsActionable(invitation);

    // Verify email match
    if (authenticatedUserEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError(
        'This invitation was sent to a different email address. You can only reject invitations addressed to your registered email.'
      );
    }

    const rejectedInvitation = await this.invitationRepo.updateStatus(invitation.id, 'REJECTED');
    if (!rejectedInvitation) {
      throw new NotFoundError('Invitation not found.');
    }

    return rejectedInvitation;
  }

  /**
   * Validates that an invitation is in an actionable state (PENDING and not expired).
   * Throws descriptive errors for each non-actionable state.
   */
  private validateInvitationIsActionable(invitation: Invitation): void {
    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestError('This invitation has already been accepted.');
    }

    if (invitation.status === 'REJECTED') {
      throw new BadRequestError('This invitation has already been rejected.');
    }

    if (invitation.status === 'REVOKED') {
      throw new BadRequestError('This invitation has been revoked by the organization.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestError(`This invitation is no longer active (status: ${invitation.status}).`);
    }

    // Check expiration
    if (new Date(invitation.expires_at) <= new Date()) {
      throw new BadRequestError(
        'This invitation has expired. Please ask the organization administrator to send a new invitation.'
      );
    }
  }
}

export const invitationService = new InvitationService();
