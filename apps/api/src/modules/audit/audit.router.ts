import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import {
  requireOrgMembership,
  requireOrgRole,
} from '../../middlewares/organization.middleware.js';
import { auditController } from './audit.controller.js';
import {
  listAuditLogsSchema,
  auditLogOrgParamSchema,
} from './audit.schema.js';

export const organizationAuditRouter: Router = Router();

organizationAuditRouter.use(authenticateUser);

/**
 * Route: GET /api/v1/organizations/:id/audit-logs
 * Description: List paginated audit logs for an organization
 * Access: Organization OWNER or ADMIN only
 */
organizationAuditRouter.get(
  '/:id/audit-logs',
  validateRequest(listAuditLogsSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  auditController.getLogsHandler
);

/**
 * Route: GET /api/v1/organizations/:id/audit-logs/filters
 * Description: List available filter options (actions, resource types)
 * Access: Organization OWNER or ADMIN only
 */
organizationAuditRouter.get(
  '/:id/audit-logs/filters',
  validateRequest(auditLogOrgParamSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  auditController.getFilterOptionsHandler
);
