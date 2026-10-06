import type { Request, Response, NextFunction } from 'express';
import { organizationRepository } from '../modules/organizations/organization.repository.js';
import { organizationMembershipRepository } from '../modules/organizations/organization-membership.repository.js';
import type {
  Organization,
  OrganizationMembership,
  OrganizationRole,
} from '../modules/organizations/organization.entity.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../errors/app-error.js';

// Augment Express Request interface with tenant organization context
declare global {
  namespace Express {
    interface Request {
      activeOrganization?: Organization;
      organizationMembership?: OrganizationMembership;
    }
  }
}

/**
 * Middleware factory that enforces the authenticated user is an active member
 * of the specified organization. Loads the organization and membership into req.
 *
 * @param paramKey - The route parameter name containing the organization UUID (default: 'id').
 */
export const requireOrgMembership = (paramKey = 'id') => {
  return async (
    incomingRequest: Request,
    _outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      if (!incomingRequest.authenticatedUser) {
        throw new UnauthorizedError('Authentication required to access organization resources.');
      }

      const rawOrgId =
        incomingRequest.params[paramKey] ?? incomingRequest.headers['x-organization-id'];

      const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;

      if (!organizationId || typeof organizationId !== 'string') {
        throw new NotFoundError('Organization identifier is required.');
      }

      // Check if organization exists
      const targetOrganization = await organizationRepository.findById(organizationId);
      if (!targetOrganization) {
        throw new NotFoundError('Organization not found.');
      }

      if (targetOrganization.status === 'SUSPENDED') {
        throw new ForbiddenError(
          'This organization has been suspended by the platform administrator. Its data is preserved, but it cannot be used until it is reactivated.',
          { code: 'ORGANIZATION_SUSPENDED' }
        );
      }

      // Check if user is a member of this organization
      const userMembership = await organizationMembershipRepository.findByUserAndOrg(
        incomingRequest.authenticatedUser.id,
        organizationId
      );

      if (!userMembership) {
        throw new ForbiddenError('You do not have access to this organization.');
      }

      // Attach tenant context to the request for downstream handlers
      incomingRequest.activeOrganization = targetOrganization;
      incomingRequest.organizationMembership = userMembership;

      nextMiddleware();
    } catch (middlewareError) {
      nextMiddleware(middlewareError);
    }
  };
};

/**
 * Middleware factory that restricts access to users holding one of the specified organization roles.
 * Must be executed after requireOrgMembership.
 *
 * @param allowedRoles - Array of roles permitted to access the route.
 */
export const requireOrgRole = (allowedRoles: OrganizationRole[]) => {
  return (
    incomingRequest: Request,
    _outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): void => {
    const userMembership = incomingRequest.organizationMembership;

    if (!userMembership) {
      return nextMiddleware(
        new ForbiddenError('Organization membership context is required for role verification.')
      );
    }

    if (!allowedRoles.includes(userMembership.role)) {
      return nextMiddleware(
        new ForbiddenError(
          `Insufficient permissions. This operation requires one of: ${allowedRoles.join(', ')}.`
        )
      );
    }

    nextMiddleware();
  };
};
