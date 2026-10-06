import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { requireProjectAccess } from '../../middlewares/project.middleware.js';
import {
  requireDocumentAccess,
  requireDocumentManager,
  requireDocumentManageAccess,
} from '../../middlewares/document.middleware.js';
import { handleDocumentUpload } from '../../middlewares/upload.middleware.js';
import { documentController } from './document.controller.js';
import { documentAccessController } from './document-access.controller.js';
import {
  uploadDocumentSchema,
  listProjectDocumentsSchema,
  documentIdParamSchema,
  updateDocumentSchema,
} from './document.schema.js';
import {
  updateDocumentAccessModeSchema,
  setUserAccessRuleSchema,
  setGroupAccessRuleSchema,
  setOrgRoleAccessRuleSchema,
  setProjectRoleAccessRuleSchema,
  targetUserIdParamSchema,
  targetGroupIdParamSchema,
  targetOrgRoleParamSchema,
  targetProjectRoleParamSchema,
} from './document-access.schema.js';

// ---------------------------------------------------------------------------
// 1. Project-Scoped Document Router
// Mounted at: /api/v1/projects
// ---------------------------------------------------------------------------
export const projectDocumentsRouter: Router = Router();

projectDocumentsRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/projects/:id/documents
 * Description: Upload a new document to a project (PDF, DOCX, XLSX, TXT, PPTX)
 * Access: Authorized project member or organization OWNER
 */
projectDocumentsRouter.post(
  '/:id/documents',
  requireProjectAccess('id'),
  handleDocumentUpload,
  validateRequest(uploadDocumentSchema),
  documentController.uploadDocumentHandler
);

/**
 * Route: GET /api/v1/projects/:id/documents
 * Description: List all documents in a project with processing statuses
 * Access: Authorized project member or organization OWNER
 */
projectDocumentsRouter.get(
  '/:id/documents',
  validateRequest(listProjectDocumentsSchema),
  requireProjectAccess('id'),
  documentController.listProjectDocumentsHandler
);

// ---------------------------------------------------------------------------
// 2. Direct Document Router
// Mounted at: /api/v1/documents
// ---------------------------------------------------------------------------
export const documentRouter: Router = Router();

documentRouter.use(authenticateUser);

/**
 * Route: GET /api/v1/documents/:id
 * Description: Get document details and current version processing status
 * Access: Authorized project member (evaluates 6-step pipeline if RESTRICTED)
 */
documentRouter.get(
  '/:id',
  validateRequest(documentIdParamSchema),
  requireDocumentAccess('id'),
  documentController.getDocumentHandler
);

/**
 * Route: GET /api/v1/documents/:id/download
 * Description: Download original document file (streaming or presigned URL)
 * Access: Authorized project member (evaluates 6-step pipeline if RESTRICTED)
 */
documentRouter.get(
  '/:id/download',
  validateRequest(documentIdParamSchema),
  requireDocumentAccess('id'),
  documentController.downloadDocumentHandler
);

/**
 * Route: POST /api/v1/documents/:id/reprocess
 * Description: Retry processing of a document whose status is FAILED
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.post(
  '/:id/reprocess',
  validateRequest(documentIdParamSchema),
  requireDocumentManageAccess('id'),
  documentController.reprocessDocumentHandler
);

/**
 * Route: PATCH /api/v1/documents/:id
 * Description: Update document metadata (name, description, access_mode)
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.patch(
  '/:id',
  validateRequest(updateDocumentSchema),
  requireDocumentManageAccess('id'),
  documentController.updateDocumentHandler
);

/**
 * Route: DELETE /api/v1/documents/:id
 * Description: Delete document from database and purge from storage
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.delete(
  '/:id',
  validateRequest(documentIdParamSchema),
  requireDocumentManageAccess('id'),
  documentController.deleteDocumentHandler
);

// ---------------------------------------------------------------------------
// 3. Document Access Control Routes
// Mounted at: /api/v1/documents/:id
// ---------------------------------------------------------------------------

/**
 * Route: PATCH /api/v1/documents/:id/access-mode
 * Description: Update document access mode (PROJECT vs RESTRICTED)
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.patch(
  '/:id/access-mode',
  requireDocumentManageAccess('id'),
  validateRequest(updateDocumentAccessModeSchema),
  documentAccessController.setAccessModeHandler
);

/**
 * Route: GET /api/v1/documents/:id/access-rules
 * Description: Get all access rules configured on a document
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.get(
  '/:id/access-rules',
  requireDocumentManageAccess('id'),
  validateRequest(documentIdParamSchema),
  documentAccessController.getDocumentRulesHandler
);

/**
 * Route: POST /api/v1/documents/:id/access-rules/users
 * Description: Add or update an individual user access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.post(
  '/:id/access-rules/users',
  requireDocumentManageAccess('id'),
  validateRequest(setUserAccessRuleSchema),
  documentAccessController.setUserRuleHandler
);

/**
 * Route: DELETE /api/v1/documents/:id/access-rules/users/:userId
 * Description: Remove an individual user access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.delete(
  '/:id/access-rules/users/:userId',
  requireDocumentManageAccess('id'),
  validateRequest(targetUserIdParamSchema),
  documentAccessController.deleteUserRuleHandler
);

/**
 * Route: POST /api/v1/documents/:id/access-rules/groups
 * Description: Add or update a group access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.post(
  '/:id/access-rules/groups',
  requireDocumentManageAccess('id'),
  validateRequest(setGroupAccessRuleSchema),
  documentAccessController.setGroupRuleHandler
);

/**
 * Route: DELETE /api/v1/documents/:id/access-rules/groups/:groupId
 * Description: Remove a group access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.delete(
  '/:id/access-rules/groups/:groupId',
  requireDocumentManageAccess('id'),
  validateRequest(targetGroupIdParamSchema),
  documentAccessController.deleteGroupRuleHandler
);

/**
 * Route: POST /api/v1/documents/:id/access-rules/org-roles
 * Description: Add or update an organization role access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.post(
  '/:id/access-rules/org-roles',
  requireDocumentManageAccess('id'),
  validateRequest(setOrgRoleAccessRuleSchema),
  documentAccessController.setOrgRoleRuleHandler
);

/**
 * Route: DELETE /api/v1/documents/:id/access-rules/org-roles/:role
 * Description: Remove an organization role access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.delete(
  '/:id/access-rules/org-roles/:role',
  requireDocumentManageAccess('id'),
  validateRequest(targetOrgRoleParamSchema),
  documentAccessController.deleteOrgRoleRuleHandler
);

/**
 * Route: POST /api/v1/documents/:id/access-rules/project-roles
 * Description: Add or update a project role access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.post(
  '/:id/access-rules/project-roles',
  requireDocumentManageAccess('id'),
  validateRequest(setProjectRoleAccessRuleSchema),
  documentAccessController.setProjectRoleRuleHandler
);

/**
 * Route: DELETE /api/v1/documents/:id/access-rules/project-roles/:role
 * Description: Remove a project role access rule
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.delete(
  '/:id/access-rules/project-roles/:role',
  requireDocumentManageAccess('id'),
  validateRequest(targetProjectRoleParamSchema),
  documentAccessController.deleteProjectRoleRuleHandler
);

