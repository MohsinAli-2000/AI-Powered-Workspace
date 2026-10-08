import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { rateLimit } from '../../middlewares/rate-limit.middleware.js';
import {
  requireOrgMembership,
  requireOrgRole,
} from '../../middlewares/organization.middleware.js';
import { invitationController } from './invitation.controller.js';
import {
  createInvitationSchema,
  listInvitationsSchema,
  revokeInvitationSchema,
  acceptInvitationSchema,
  rejectInvitationSchema,
  invitationDetailsQuerySchema,
  invitationDetailsBodySchema,
  acceptAndRegisterSchema,
} from './invitation.schema.js';

// ---------------------------------------------------------------------------
// Organization-scoped invitation routes
// Mounted at: /api/v1/organizations
// ---------------------------------------------------------------------------
export const invitationOrgRouter: Router = Router();

// All org-scoped invitation routes require authentication
invitationOrgRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/organizations/:id/invitations
 * Description: Create and send a new organization invitation
 * Access: OWNER or ADMIN only
 */
invitationOrgRouter.post(
  '/:id/invitations',
  validateRequest(createInvitationSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  invitationController.createInvitationHandler
);

/**
 * Route: GET /api/v1/organizations/:id/invitations
 * Description: List all invitations for an organization
 * Access: OWNER or ADMIN only (the list exposes invitee e-mail addresses)
 */
invitationOrgRouter.get(
  '/:id/invitations',
  validateRequest(listInvitationsSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  invitationController.listInvitationsHandler
);

/**
 * Route: DELETE /api/v1/organizations/:id/invitations/:invitationId
 * Description: Revoke a pending invitation
 * Access: OWNER or ADMIN only
 */
invitationOrgRouter.delete(
  '/:id/invitations/:invitationId',
  validateRequest(revokeInvitationSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  invitationController.revokeInvitationHandler
);

// ---------------------------------------------------------------------------
// Public invitation action routes (token-based, not org-scoped)
// Mounted at: /api/v1/invitations
// ---------------------------------------------------------------------------
export const invitationPublicRouter: Router = Router();

const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

/**
 * Route: GET /api/v1/invitations/details
 * Description: Retrieve invitation details by query token
 * Access: Public (token required)
 */
invitationPublicRouter.get(
  '/details',
  validateRequest(invitationDetailsQuerySchema),
  invitationController.getInvitationDetailsHandler
);

/**
 * Route: POST /api/v1/invitations/details
 * Description: Retrieve invitation details by body token
 * Access: Public (token required)
 */
invitationPublicRouter.post(
  '/details',
  validateRequest(invitationDetailsBodySchema),
  invitationController.getInvitationDetailsHandler
);

/**
 * Route: POST /api/v1/invitations/accept-and-register
 * Description: Accept invitation by setting password and creating account (auto-authenticates)
 * Access: Public (valid invitation token required)
 */
invitationPublicRouter.post(
  '/accept-and-register',
  invitationLimiter,
  validateRequest(acceptAndRegisterSchema),
  invitationController.acceptAndRegisterHandler
);

/**
 * Route: POST /api/v1/invitations/accept
 * Description: Accept an invitation via token (authenticated user, email must match)
 * Access: Any authenticated user whose email matches the invitation
 */
invitationPublicRouter.post(
  '/accept',
  authenticateUser,
  validateRequest(acceptInvitationSchema),
  invitationController.acceptInvitationHandler
);

/**
 * Route: POST /api/v1/invitations/reject
 * Description: Reject an invitation via token (authenticated user, email must match)
 * Access: Any authenticated user whose email matches the invitation
 */
invitationPublicRouter.post(
  '/reject',
  authenticateUser,
  validateRequest(rejectInvitationSchema),
  invitationController.rejectInvitationHandler
);
