import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { requireOrgMembership } from '../../middlewares/organization.middleware.js';
import {
  requireProjectAccess,
  requireProjectManager,
} from '../../middlewares/project.middleware.js';
import { projectController } from './project.controller.js';
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdParamSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
  removeProjectMemberSchema,
} from './project.schema.js';

// ---------------------------------------------------------------------------
// 1. Organization-Scoped Project Router
// Mounted at: /api/v1/organizations
// ---------------------------------------------------------------------------
export const organizationProjectsRouter: Router = Router();

organizationProjectsRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/organizations/:id/projects
 * Description: Create a new project within an organization (creator becomes initial PROJECT_MANAGER)
 * Access: Any organization member
 */
organizationProjectsRouter.post(
  '/:id/projects',
  validateRequest(createProjectSchema),
  requireOrgMembership('id'),
  projectController.createProjectHandler
);

/**
 * Route: GET /api/v1/organizations/:id/projects
 * Description: List authorized projects for the user within an organization
 * Access: Organization members (OWNER sees all; regular members see their projects)
 */
organizationProjectsRouter.get(
  '/:id/projects',
  validateRequest(listProjectsSchema),
  requireOrgMembership('id'),
  projectController.listOrganizationProjectsHandler
);

// ---------------------------------------------------------------------------
// 2. Direct Project Router
// Mounted at: /api/v1/projects
// ---------------------------------------------------------------------------
export const projectRouter: Router = Router();

projectRouter.use(authenticateUser);

/**
 * Route: GET /api/v1/projects/:id
 * Description: Get project details and user's role
 * Access: Authorized project member or organization OWNER
 */
projectRouter.get(
  '/:id',
  validateRequest(projectIdParamSchema),
  requireProjectAccess('id'),
  projectController.getProjectHandler
);

/**
 * Route: PATCH /api/v1/projects/:id
 * Description: Update project name or description
 * Access: PROJECT_MANAGER or organization OWNER
 */
projectRouter.patch(
  '/:id',
  validateRequest(updateProjectSchema),
  requireProjectAccess('id'),
  requireProjectManager,
  projectController.updateProjectHandler
);

/**
 * Route: DELETE /api/v1/projects/:id
 * Description: Delete project and cascade memberships
 * Access: PROJECT_MANAGER or organization OWNER
 */
projectRouter.delete(
  '/:id',
  validateRequest(projectIdParamSchema),
  requireProjectAccess('id'),
  requireProjectManager,
  projectController.deleteProjectHandler
);

/**
 * Route: GET /api/v1/projects/:id/members
 * Description: List all members of a project
 * Access: Authorized project member or organization OWNER
 */
projectRouter.get(
  '/:id/members',
  validateRequest(projectIdParamSchema),
  requireProjectAccess('id'),
  projectController.listProjectMembersHandler
);

/**
 * Route: POST /api/v1/projects/:id/members
 * Description: Add an existing organization member to a project
 * Access: PROJECT_MANAGER or organization OWNER
 */
projectRouter.post(
  '/:id/members',
  validateRequest(addProjectMemberSchema),
  requireProjectAccess('id'),
  requireProjectManager,
  projectController.addProjectMemberHandler
);

/**
 * Route: PATCH /api/v1/projects/:id/members/:userId/role
 * Description: Update a project member's role (enforces PM minimum count)
 * Access: PROJECT_MANAGER or organization OWNER
 */
projectRouter.patch(
  '/:id/members/:userId/role',
  validateRequest(updateProjectMemberRoleSchema),
  requireProjectAccess('id'),
  requireProjectManager,
  projectController.updateProjectMemberRoleHandler
);

/**
 * Route: DELETE /api/v1/projects/:id/members/:userId
 * Description: Remove a member from a project or leave project (enforces PM minimum count)
 * Access: PROJECT_MANAGER, organization OWNER, or self-removal
 */
projectRouter.delete(
  '/:id/members/:userId',
  validateRequest(removeProjectMemberSchema),
  requireProjectAccess('id'),
  projectController.removeProjectMemberHandler
);
