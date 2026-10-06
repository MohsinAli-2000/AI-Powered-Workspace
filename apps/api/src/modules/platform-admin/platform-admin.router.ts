import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { requirePlatformAdmin } from '../../middlewares/platform-admin.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { platformAdminController } from './platform-admin.controller.js';
import {
  listAdminOrganizationsSchema,
  suspendOrganizationSchema,
  reactivateOrganizationSchema,
  deleteOrganizationSchema,
} from './platform-admin.schema.js';

/**
 * Platform administration (product owner) routes, mounted at /api/v1/admin.
 * Every route requires an authenticated user with users.is_platform_admin = TRUE.
 */
export const platformAdminRouter: Router = Router();

platformAdminRouter.use(authenticateUser, requirePlatformAdmin);

platformAdminRouter.get('/stats', platformAdminController.getStatsHandler);

platformAdminRouter.get(
  '/organizations',
  validateRequest(listAdminOrganizationsSchema),
  platformAdminController.listOrganizationsHandler
);

platformAdminRouter.post(
  '/organizations/:id/suspend',
  validateRequest(suspendOrganizationSchema),
  platformAdminController.suspendHandler
);

platformAdminRouter.post(
  '/organizations/:id/reactivate',
  validateRequest(reactivateOrganizationSchema),
  platformAdminController.reactivateHandler
);

platformAdminRouter.delete(
  '/organizations/:id',
  validateRequest(deleteOrganizationSchema),
  platformAdminController.deleteOrganizationHandler
);

