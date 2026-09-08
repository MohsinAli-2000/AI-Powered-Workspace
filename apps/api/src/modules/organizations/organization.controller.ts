import type { Request, Response, NextFunction } from 'express';
import {
  organizationService,
  type OrganizationService,
} from './organization.service.js';
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  TransferOwnershipInput,
  UpdateMemberRoleInput,
} from './organization.schema.js';

export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService = organizationService
  ) {}

  /**
   * Handles creating a new organization.
   */
  public createOrganizationHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, CreateOrganizationInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const creatorUserId = incomingRequest.authenticatedUser!.id;
      const createdOrg = await this.orgService.createOrganization(
        creatorUserId,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { organization: createdOrg },
        message: 'Organization created successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all organizations the authenticated user belongs to.
   */
  public getUserOrganizationsHandler = async (
    incomingRequest: Request,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const userOrgs = await this.orgService.getUserOrganizations(userId);

      outgoingResponse.status(200).json({
        success: true,
        data: { organizations: userOrgs },
        message: 'User organizations retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles retrieving details for a single organization.
   */
  public getOrganizationHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const orgDetails = await this.orgService.getOrganizationDetails(
        organizationId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { organization: orgDetails },
        message: 'Organization details retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all members of an organization.
   */
  public getOrganizationMembersHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const membersList = await this.orgService.getOrganizationMembers(
        organizationId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { members: membersList },
        message: 'Organization members retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating organization settings.
   */
  public updateOrganizationHandler = async (
    incomingRequest: Request<{ id: string }, unknown, UpdateOrganizationInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const updatedOrg = await this.orgService.updateOrganization(
        organizationId,
        userId,
        incomingRequest.body
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { organization: updatedOrg },
        message: 'Organization updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles transferring organization ownership to another member.
   */
  public transferOwnershipHandler = async (
    incomingRequest: Request<{ id: string }, unknown, TransferOwnershipInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const currentOwnerId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const updatedOrg = await this.orgService.transferOwnership(
        organizationId,
        currentOwnerId,
        incomingRequest.body
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { organization: updatedOrg },
        message: 'Organization ownership transferred successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles deleting an organization.
   */
  public deleteOrganizationHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      await this.orgService.deleteOrganization(organizationId, userId);

      outgoingResponse.status(200).json({
        success: true,
        data: null,
        message: 'Organization deleted successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles removing a member from an organization.
   * Route: DELETE /api/v1/organizations/:id/members/:userId
   */
  public removeMemberHandler = async (
    incomingRequest: Request<{ id: string; userId: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;
      const targetUserId = incomingRequest.params.userId;

      await this.orgService.removeMember(organizationId, targetUserId, actingUserId);

      outgoingResponse.status(200).json({
        success: true,
        data: null,
        message: 'Member removed from the organization successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating a member's organization role.
   * Route: PATCH /api/v1/organizations/:id/members/:userId/role
   */
  public updateMemberRoleHandler = async (
    incomingRequest: Request<{ id: string; userId: string }, unknown, UpdateMemberRoleInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;
      const targetUserId = incomingRequest.params.userId;

      const updatedMember = await this.orgService.updateMemberRole(
        organizationId,
        targetUserId,
        incomingRequest.body.role,
        actingUserId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { member: updatedMember },
        message: 'Member role updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const organizationController = new OrganizationController();
