import type { Request, Response, NextFunction } from 'express';
import {
  projectService,
  type ProjectService,
} from './project.service.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddProjectMemberInput,
  UpdateProjectMemberRoleInput,
} from './project.schema.js';

export class ProjectController {
  constructor(
    private readonly projService: ProjectService = projectService
  ) {}

  /**
   * Handles creating a new project in an organization.
   * Route: POST /api/v1/organizations/:id/projects
   */
  public createProjectHandler = async (
    incomingRequest: Request<{ id: string }, unknown, CreateProjectInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const creatorUserId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const createdProject = await this.projService.createProject(
        organizationId,
        creatorUserId,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { project: createdProject },
        message: 'Project created successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all authorized projects in an organization.
   * Route: GET /api/v1/organizations/:id/projects
   */
  public listOrganizationProjectsHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const organizationId = incomingRequest.params.id;

      const projects = await this.projService.listProjects(
        organizationId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { projects },
        message: 'Projects retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles retrieving details for a single project.
   * Route: GET /api/v1/projects/:id
   */
  public getProjectHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;

      const project = await this.projService.getProjectDetails(
        projectId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { project },
        message: 'Project retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating project settings (name, description).
   * Route: PATCH /api/v1/projects/:id
   */
  public updateProjectHandler = async (
    incomingRequest: Request<{ id: string }, unknown, UpdateProjectInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;

      const updatedProject = await this.projService.updateProject(
        projectId,
        actingUserId,
        incomingRequest.body
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { project: updatedProject },
        message: 'Project updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles deleting a project.
   * Route: DELETE /api/v1/projects/:id
   */
  public deleteProjectHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;

      await this.projService.deleteProject(projectId, actingUserId);

      outgoingResponse.status(200).json({
        success: true,
        data: null,
        message: 'Project deleted successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles adding a member to a project.
   * Route: POST /api/v1/projects/:id/members
   */
  public addProjectMemberHandler = async (
    incomingRequest: Request<{ id: string }, unknown, AddProjectMemberInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;

      const member = await this.projService.addMember(
        projectId,
        actingUserId,
        incomingRequest.body
      );

      outgoingResponse.status(201).json({
        success: true,
        data: { member },
        message: 'Member added to project successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles updating a member's role in a project.
   * Route: PATCH /api/v1/projects/:id/members/:userId/role
   */
  public updateProjectMemberRoleHandler = async (
    incomingRequest: Request<
      { id: string; userId: string },
      unknown,
      UpdateProjectMemberRoleInput
    >,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;
      const targetUserId = incomingRequest.params.userId;

      const updatedMembership = await this.projService.updateMemberRole(
        projectId,
        targetUserId,
        incomingRequest.body.role,
        actingUserId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { membership: updatedMembership },
        message: 'Project member role updated successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles removing a member from a project.
   * Route: DELETE /api/v1/projects/:id/members/:userId
   */
  public removeProjectMemberHandler = async (
    incomingRequest: Request<{ id: string; userId: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const actingUserId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;
      const targetUserId = incomingRequest.params.userId;

      await this.projService.removeMember(
        projectId,
        targetUserId,
        actingUserId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: null,
        message: 'Member removed from project successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles listing all members of a project.
   * Route: GET /api/v1/projects/:id/members
   */
  public listProjectMembersHandler = async (
    incomingRequest: Request<{ id: string }>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const userId = incomingRequest.authenticatedUser!.id;
      const projectId = incomingRequest.params.id;

      const members = await this.projService.listProjectMembers(
        projectId,
        userId
      );

      outgoingResponse.status(200).json({
        success: true,
        data: { members },
        message: 'Project members retrieved successfully.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const projectController = new ProjectController();
