import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import {
  requireOrgMembership,
  requireOrgRole,
} from '../../middlewares/organization.middleware.js';
import { organizationController } from './organization.controller.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  transferOwnershipSchema,
  organizationIdParamSchema,
  memberActionParamSchema,
  updateMemberRoleSchema,
} from './organization.schema.js';

export const organizationRouter: Router = Router();

// All organization routes require authenticated session
organizationRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/organizations
 * Description: Create a new organization with caller as OWNER
 */
organizationRouter.post(
  '/',
  validateRequest(createOrganizationSchema),
  organizationController.createOrganizationHandler
);

/**
 * Route: GET /api/v1/organizations
 * Description: List all organizations the user belongs to
 */
organizationRouter.get(
  '/',
  organizationController.getUserOrganizationsHandler
);

/**
 * Route: GET /api/v1/organizations/:id
 * Description: Get organization details (requires membership)
 */
organizationRouter.get(
  '/:id',
  validateRequest(organizationIdParamSchema),
  requireOrgMembership('id'),
  organizationController.getOrganizationHandler
);

/**
 * Route: GET /api/v1/organizations/:id/members
 * Description: List members of an organization (requires membership)
 */
organizationRouter.get(
  '/:id/members',
  validateRequest(organizationIdParamSchema),
  requireOrgMembership('id'),
  organizationController.getOrganizationMembersHandler
);

/**
 * Route: PATCH /api/v1/organizations/:id
 * Description: Update organization name/settings (requires OWNER or ADMIN role)
 */
organizationRouter.patch(
  '/:id',
  validateRequest(updateOrganizationSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  organizationController.updateOrganizationHandler
);

/**
 * Route: POST /api/v1/organizations/:id/transfer-ownership
 * Description: Transfer organization ownership to another member (requires OWNER role)
 */
organizationRouter.post(
  '/:id/transfer-ownership',
  validateRequest(transferOwnershipSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER']),
  organizationController.transferOwnershipHandler
);

/**
 * Route: DELETE /api/v1/organizations/:id
 * Description: Delete organization and cascading data (requires OWNER role)
 */
organizationRouter.delete(
  '/:id',
  validateRequest(organizationIdParamSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER']),
  organizationController.deleteOrganizationHandler
);

/**
 * Route: DELETE /api/v1/organizations/:id/members/:userId
 * Description: Remove a member from the organization (requires OWNER role — MVP)
 */
organizationRouter.delete(
  '/:id/members/:userId',
  validateRequest(memberActionParamSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER']),
  organizationController.removeMemberHandler
);

/**
 * Route: PATCH /api/v1/organizations/:id/members/:userId/role
 * Description: Update a member's organization role (requires OWNER or ADMIN role)
 */
organizationRouter.patch(
  '/:id/members/:userId/role',
  validateRequest(updateMemberRoleSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  organizationController.updateMemberRoleHandler
);
