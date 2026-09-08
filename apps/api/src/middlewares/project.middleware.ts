import type { Request, Response, NextFunction } from 'express';
import { projectRepository } from '../modules/projects/project.repository.js';
import { projectMembershipRepository } from '../modules/projects/project-membership.repository.js';
import { organizationMembershipRepository } from '../modules/organizations/organization-membership.repository.js';
import { organizationRepository } from '../modules/organizations/organization.repository.js';
import type {
  Project,
  ProjectMembership,
} from '../modules/projects/project.entity.js';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../errors/app-error.js';

// Augment Express Request interface with project context
declare global {
  namespace Express {
    interface Request {
      activeProject?: Project;
      projectMembership?: ProjectMembership;
      isProjectManager?: boolean;
    }
  }
}

/**
 * Middleware factory that enforces the user belongs to the project's parent organization
 * and has permission to access the project (either as a project member or as the org OWNER).
 *
 * Attaches `req.activeProject`, `req.projectMembership`, and `req.isProjectManager`.
 */
export const requireProjectAccess = (paramKey = 'id') => {
  return async (
    incomingRequest: Request,
    _outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      if (!incomingRequest.authenticatedUser) {
        throw new UnauthorizedError('Authentication required to access project resources.');
      }

      const rawProjectId = incomingRequest.params[paramKey];
      const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;

      if (!projectId || typeof projectId !== 'string') {
        throw new NotFoundError('Project identifier is required.');
      }

      // 1. Fetch project
      const project = await projectRepository.findById(projectId);
      if (!project) {
        throw new NotFoundError('Project not found.');
      }

      // 2. Verify user belongs to the project's parent organization
      const orgMembership =
        await organizationMembershipRepository.findByUserAndOrg(
          incomingRequest.authenticatedUser.id,
          project.organization_id
        );

      if (!orgMembership) {
        throw new ForbiddenError(
          'You do not have access to the organization that owns this project.'
        );
      }

      // Also attach organization details if not already attached
      if (!incomingRequest.activeOrganization) {
        const organization = await organizationRepository.findById(project.organization_id);
        if (organization) {
          incomingRequest.activeOrganization = organization;
        }
      }
      incomingRequest.organizationMembership = orgMembership;

      // 3. Check project-level access
      const isOrgOwner = orgMembership.role === 'OWNER';
      const userProjectMembership =
        await projectMembershipRepository.findByUserAndProject(
          incomingRequest.authenticatedUser.id,
          projectId
        );

      // Org OWNER has full governance access over all projects
      if (isOrgOwner) {
        incomingRequest.activeProject = project;
        incomingRequest.projectMembership = userProjectMembership ?? undefined;
        incomingRequest.isProjectManager = true;
        return nextMiddleware();
      }

      // Regular organization members must have explicit project membership
      if (!userProjectMembership) {
        throw new ForbiddenError('You do not have access to this project.');
      }

      incomingRequest.activeProject = project;
      incomingRequest.projectMembership = userProjectMembership;
      incomingRequest.isProjectManager =
        userProjectMembership.role === 'PROJECT_MANAGER';

      nextMiddleware();
    } catch (middlewareError) {
      nextMiddleware(middlewareError);
    }
  };
};

/**
 * Middleware that requires the user to have project management authority.
 * Authorized if:
 * - The user is a PROJECT_MANAGER of the project, OR
 * - The user is the OWNER of the project's parent organization.
 *
 * MUST be preceded by `requireProjectAccess`.
 */
export const requireProjectManager = (
  incomingRequest: Request,
  _outgoingResponse: Response,
  nextMiddleware: NextFunction
): void => {
  if (!incomingRequest.isProjectManager) {
    return nextMiddleware(
      new ForbiddenError('Project Manager authority is required to perform this action.')
    );
  }
  nextMiddleware();
};
