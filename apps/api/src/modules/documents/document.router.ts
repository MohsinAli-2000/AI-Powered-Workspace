import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { requireProjectAccess } from '../../middlewares/project.middleware.js';
import {
  requireDocumentAccess,
  requireDocumentManager,
} from '../../middlewares/document.middleware.js';
import { handleDocumentUpload } from '../../middlewares/upload.middleware.js';
import { documentController } from './document.controller.js';
import {
  uploadDocumentSchema,
  listProjectDocumentsSchema,
  documentIdParamSchema,
  updateDocumentSchema,
} from './document.schema.js';

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
 * Access: Authorized project member or organization OWNER
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
 * Access: Authorized project member or organization OWNER
 */
documentRouter.get(
  '/:id/download',
  validateRequest(documentIdParamSchema),
  requireDocumentAccess('id'),
  documentController.downloadDocumentHandler
);

/**
 * Route: PATCH /api/v1/documents/:id
 * Description: Update document metadata (name, description)
 * Access: PROJECT_MANAGER or organization OWNER
 */
documentRouter.patch(
  '/:id',
  validateRequest(updateDocumentSchema),
  requireDocumentAccess('id'),
  requireDocumentManager,
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
  requireDocumentAccess('id'),
  requireDocumentManager,
  documentController.deleteDocumentHandler
);
