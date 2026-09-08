import type { Request, Response, NextFunction } from 'express';
import {
  invitationService,
  type InvitationService,
} from './invitation.service.js';
import type { CreateInvitationInput } from './invitation.schema.js';

export class InvitationController {
  constructor(
    private readonly invService: InvitationService = invitationService
  ) {}

  /**
   * Handles creating a new organization invitation.
   * Route: POST /api/v1/organizations/:id/invitations
   */
  public createInvitationHandler = async (
    incomingRequest: Request<{ id: string }, unknown, CreateInvitationInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const inviterId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const createdInvitation = await this.invService.createInvitation(
        organizationId,
        inviterId,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { invitation: createdInvitation },
        message: 'Invitation sent successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all invitations for an organization.
   * Route: GET /api/v1/organizations/:id/invitations
   */
  public listInvitationsHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const organizationId = incomingRequest.params.id;

      const invitations = await this.invService.listOrganizationInvitations(
        organizationId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { invitations },
        message: 'Organization invitations retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles revoking a pending invitation.
   * Route: DELETE /api/v1/organizations/:id/invitations/:invitationId
   */
  public revokeInvitationHandler = async (
    incomingRequest: Request<{ id: string; invitationId: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const organizationId = incomingRequest.params.id;
      const invitationId = incomingRequest.params.invitationId;

      const revokedInvitation = await this.invService.revokeInvitation(
        organizationId,
        invitationId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { invitation: revokedInvitation },
        message: 'Invitation revoked successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles accepting an organization invitation.
   * Route: POST /api/v1/invitations/accept
   */
  public acceptInvitationHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, { token: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const authenticatedUser = incomingRequest.authenticatedUser!;

      const newMembership = await this.invService.acceptInvitation(
        incomingRequest.body.token,
        authenticatedUser.id,
        authenticatedUser.email
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { membership: newMembership },
        message: 'Invitation accepted successfully. You are now a member of the organization.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles rejecting an organization invitation.
   * Route: POST /api/v1/invitations/reject
   */
  public rejectInvitationHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, { token: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const authenticatedUser = incomingRequest.authenticatedUser!;

      const rejectedInvitation = await this.invService.rejectInvitation(
        incomingRequest.body.token,
        authenticatedUser.id,
        authenticatedUser.email
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { invitation: rejectedInvitation },
        message: 'Invitation rejected.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const invitationController = new InvitationController();
