import type { Request, Response, NextFunction } from 'express';
import { groupRepository } from '../modules/groups/group.repository.js';
import { organizationMembershipRepository } from '../modules/organizations/organization-membership.repository.js';
import { organizationRepository } from '../modules/organizations/organization.repository.js';
import type { Group } from '../modules/groups/group.entity.js';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../errors/app-error.js';

// Augment Express Request interface with group context
declare global {
  namespace Express {
    interface Request {
      activeGroup?: Group;
    }
  }
}

/**
 * Middleware factory that enforces:
 * 1. The requested group exists.
 * 2. The caller is an active member of the group's parent organization.
 *
 * Attaches `req.activeGroup`, `req.activeOrganization`, and `req.organizationMembership`.
 */
export const requireGroupAccess = (paramKey = 'id') => {
  return async (
    incomingRequest: Request,
    _outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      if (!incomingRequest.authenticatedUser) {
        throw new UnauthorizedError('Authentication required to access group resources.');
      }

      const rawGroupId = incomingRequest.params[paramKey];
      const groupId = Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId;

      if (!groupId || typeof groupId !== 'string') {
        throw new NotFoundError('Group identifier is required.');
      }

      // 1. Fetch group
      const targetGroup = await groupRepository.findById(groupId);
      if (!targetGroup) {
        throw new NotFoundError('Group not found.');
      }

      // 2. Verify user belongs to the group's parent organization
      const orgMembership = await organizationMembershipRepository.findByUserAndOrg(
        incomingRequest.authenticatedUser.id,
        targetGroup.organization_id
      );

      if (!orgMembership) {
        throw new ForbiddenError(
          'You do not have access to the organization that owns this group.'
        );
      }

      // 3. Attach organization context if not already loaded
      if (!incomingRequest.activeOrganization) {
        const organization = await organizationRepository.findById(targetGroup.organization_id);
        if (organization) {
          incomingRequest.activeOrganization = organization;
        }
      }

      incomingRequest.organizationMembership = orgMembership;
      incomingRequest.activeGroup = targetGroup;

      nextMiddleware();
    } catch (middlewareError) {
      nextMiddleware(middlewareError);
    }
  };
};

/**
 * Middleware that restricts group modifications (update, delete, member additions)
 * to organization OWNER or ADMIN roles.
 */
export const requireGroupAdmin = (
  incomingRequest: Request,
  _outgoingResponse: Response,
  nextMiddleware: NextFunction
): void => {
  const membership = incomingRequest.organizationMembership;

  if (!membership) {
    return nextMiddleware(
      new ForbiddenError('Organization membership context is required for group administration.')
    );
  }

  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return nextMiddleware(
      new ForbiddenError(
        'Insufficient permissions. Group administration requires organization OWNER or ADMIN role.'
      )
    );
  }

  nextMiddleware();
};
