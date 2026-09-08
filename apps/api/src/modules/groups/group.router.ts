import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import {
  requireOrgMembership,
  requireOrgRole,
} from '../../middlewares/organization.middleware.js';
import {
  requireGroupAccess,
  requireGroupAdmin,
} from '../../middlewares/group.middleware.js';
import { groupController } from './group.controller.js';
import {
  createGroupSchema,
  listGroupsSchema,
  groupIdParamSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  removeGroupMemberSchema,
} from './group.schema.js';

// ---------------------------------------------------------------------------
// 1. Organization-Scoped Groups Router
// Mounted at: /api/v1/organizations
// ---------------------------------------------------------------------------
export const organizationGroupsRouter: Router = Router();

organizationGroupsRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/organizations/:id/groups
 * Description: Create a new group inside an organization
 * Access: Organization OWNER or ADMIN only
 */
organizationGroupsRouter.post(
  '/:id/groups',
  validateRequest(createGroupSchema),
  requireOrgMembership('id'),
  requireOrgRole(['OWNER', 'ADMIN']),
  groupController.createGroupHandler
);

/**
 * Route: GET /api/v1/organizations/:id/groups
 * Description: List all groups in an organization
 * Access: Any organization member
 */
organizationGroupsRouter.get(
  '/:id/groups',
  validateRequest(listGroupsSchema),
  requireOrgMembership('id'),
  groupController.listOrganizationGroupsHandler
);

// ---------------------------------------------------------------------------
// 2. Direct Group Router
// Mounted at: /api/v1/groups
// ---------------------------------------------------------------------------
export const groupRouter: Router = Router();

groupRouter.use(authenticateUser);

/**
 * Route: GET /api/v1/groups/:id
 * Description: Get group details and membership status
 * Access: Any member of the group's parent organization
 */
groupRouter.get(
  '/:id',
  validateRequest(groupIdParamSchema),
  requireGroupAccess('id'),
  groupController.getGroupHandler
);

/**
 * Route: PATCH /api/v1/groups/:id
 * Description: Update group name or description
 * Access: Organization OWNER or ADMIN
 */
groupRouter.patch(
  '/:id',
  validateRequest(updateGroupSchema),
  requireGroupAccess('id'),
  requireGroupAdmin,
  groupController.updateGroupHandler
);

/**
 * Route: DELETE /api/v1/groups/:id
 * Description: Delete a group and cascade its memberships
 * Access: Organization OWNER or ADMIN
 */
groupRouter.delete(
  '/:id',
  validateRequest(groupIdParamSchema),
  requireGroupAccess('id'),
  requireGroupAdmin,
  groupController.deleteGroupHandler
);

/**
 * Route: GET /api/v1/groups/:id/members
 * Description: List all members of a group with user profiles
 * Access: Any member of the group's parent organization
 */
groupRouter.get(
  '/:id/members',
  validateRequest(groupIdParamSchema),
  requireGroupAccess('id'),
  groupController.listGroupMembersHandler
);

/**
 * Route: POST /api/v1/groups/:id/members
 * Description: Add an organization member to the group
 * Access: Organization OWNER or ADMIN
 */
groupRouter.post(
  '/:id/members',
  validateRequest(addGroupMemberSchema),
  requireGroupAccess('id'),
  requireGroupAdmin,
  groupController.addGroupMemberHandler
);

/**
 * Route: DELETE /api/v1/groups/:id/members/:userId
 * Description: Remove a member from the group (or leave the group)
 * Access: Organization OWNER, ADMIN, or the member themselves (self-removal)
 */
groupRouter.delete(
  '/:id/members/:userId',
  validateRequest(removeGroupMemberSchema),
  requireGroupAccess('id'),
  groupController.removeGroupMemberHandler
);
