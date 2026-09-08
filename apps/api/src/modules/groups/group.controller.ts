import type { Request, Response, NextFunction } from 'express';
import { groupService, type GroupService } from './group.service.js';
import type {
  CreateGroupInput,
  UpdateGroupInput,
} from './group.schema.js';

export class GroupController {
  constructor(private readonly grpService: GroupService = groupService) {}

  /**
   * Handles creating a new group in an organization.
   * Route: POST /api/v1/organizations/:id/groups
   */
  public createGroupHandler = async (
    incomingRequest: Request<{ id: string }, unknown, CreateGroupInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const creatorUserId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const createdGroup = await this.grpService.createGroup(
        organizationId,
        creatorUserId,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { group: createdGroup },
        message: 'Group created successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all groups in an organization.
   * Route: GET /api/v1/organizations/:id/groups
   */
  public listOrganizationGroupsHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const groups = await this.grpService.listOrganizationGroups(
        organizationId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { groups },
        message: 'Groups retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles retrieving details for a single group.
   * Route: GET /api/v1/groups/:id
   */
  public getGroupHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const groupId = incomingRequest.params.id;

      const group = await this.grpService.getGroup(groupId, userId);

      outgoingResponse.status(200).json({
        success: true,
        data: { group },
        message: 'Group retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating a group's name and/or description.
   * Route: PATCH /api/v1/groups/:id
   */
  public updateGroupHandler = async (
    incomingRequest: Request<{ id: string }, unknown, UpdateGroupInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const groupId = incomingRequest.params.id;

      const updatedGroup = await this.grpService.updateGroup(
        groupId,
        incomingRequest.body
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { group: updatedGroup },
        message: 'Group updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles deleting a group.
   * Route: DELETE /api/v1/groups/:id
   */
  public deleteGroupHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const groupId = incomingRequest.params.id;

      await this.grpService.deleteGroup(groupId);

      outgoingResponse.status(200).json({
        success: true,
        message: 'Group deleted successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all members of a group.
   * Route: GET /api/v1/groups/:id/members
   */
  public listGroupMembersHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const groupId = incomingRequest.params.id;

      const members = await this.grpService.listGroupMembers(groupId);

      outgoingResponse.status(200).json({
        success: true,
        data: { members },
        message: 'Group members retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles adding a member to a group.
   * Route: POST /api/v1/groups/:id/members
   */
  public addGroupMemberHandler = async (
    incomingRequest: Request<{ id: string }, unknown, { userId?: string; user_id?: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const groupId = incomingRequest.params.id;
      const targetUserId = incomingRequest.body.userId || incomingRequest.body.user_id;

      if (!targetUserId) {
        outgoingResponse.status(400).json({
          success: false,
          message: 'User identifier is required.',
        });
        return;
      }

      const membership = await this.grpService.addGroupMember(
        groupId,
        targetUserId
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { membership },
        message: 'Member added to group successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles removing a member from a group (admin removal or self-removal).
   * Route: DELETE /api/v1/groups/:id/members/:userId
   */
  public removeGroupMemberHandler = async (
    incomingRequest: Request<{ id: string; userId: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const groupId = incomingRequest.params.id;
      const targetUserId = incomingRequest.params.userId;
      const callerUserId = incomingRequest.authenticatedUser!.id;
      const callerOrgRole = incomingRequest.organizationMembership!.role;

      await this.grpService.removeGroupMember(
        groupId,
        targetUserId,
        callerUserId,
        callerOrgRole
      );

      outgoingResponse.status(200).json({
        success: true,
        message: 'Member removed from group successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const groupController = new GroupController();
