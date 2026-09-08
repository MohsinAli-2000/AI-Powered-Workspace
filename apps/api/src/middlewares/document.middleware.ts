import type { Request, Response, NextFunction } from 'express';
import { documentRepository } from '../modules/documents/document.repository.js';
import { organizationMembershipRepository } from '../modules/organizations/organization-membership.repository.js';
import { projectMembershipRepository } from '../modules/projects/project-membership.repository.js';
import { projectRepository } from '../modules/projects/project.repository.js';
import { organizationRepository } from '../modules/organizations/organization.repository.js';
import type { Document } from '../modules/documents/document.entity.js';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../errors/app-error.js';

// Augment Express Request interface with document context
declare global {
  namespace Express {
    interface Request {
      activeDocument?: Document;
    }
  }
}

/**
 * Middleware factory that enforces:
 * 1. The requested document exists.
 * 2. The caller belongs to the document's parent organization.
 * 3. The caller is authorized in the document's parent project (as project member or org OWNER).
 *
 * Attaches `req.activeDocument`, `req.activeProject`, `req.organizationMembership`,
 * `req.projectMembership`, and `req.isProjectManager`.
 */
export const requireDocumentAccess = (paramKey = 'id') => {
  return async (
    incomingRequest: Request,
    _outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      if (!incomingRequest.authenticatedUser) {
        throw new UnauthorizedError('Authentication required to access document resources.');
      }

      const rawDocId = incomingRequest.params[paramKey];
      const documentId = Array.isArray(rawDocId) ? rawDocId[0] : rawDocId;

      if (!documentId || typeof documentId !== 'string') {
        throw new NotFoundError('Document identifier is required.');
      }

      // 1. Fetch document
      const targetDocument = await documentRepository.findById(documentId);
      if (!targetDocument) {
        throw new NotFoundError('Document not found.');
      }

      // 2. Verify user belongs to the document's organization
      const orgMembership = await organizationMembershipRepository.findByUserAndOrg(
        incomingRequest.authenticatedUser.id,
        targetDocument.organization_id
      );

      if (!orgMembership) {
        throw new ForbiddenError(
          'You do not have access to the organization that owns this document.'
        );
      }

      // 3. Verify user belongs to the document's project (or is organization OWNER)
      const isOrgOwner = orgMembership.role === 'OWNER';
      const userProjectMembership = await projectMembershipRepository.findByUserAndProject(
        incomingRequest.authenticatedUser.id,
        targetDocument.project_id
      );

      if (!isOrgOwner && !userProjectMembership) {
        throw new ForbiddenError(
          'You do not have access to the project that owns this document.'
        );
      }

      // Attach context to request
      incomingRequest.activeDocument = targetDocument;
      incomingRequest.organizationMembership = orgMembership;
      incomingRequest.projectMembership = userProjectMembership ?? undefined;
      incomingRequest.isProjectManager =
        isOrgOwner || userProjectMembership?.role === 'PROJECT_MANAGER';

      // Attach project and org objects if needed
      if (!incomingRequest.activeProject) {
        const project = await projectRepository.findById(targetDocument.project_id);
        if (project) {
          incomingRequest.activeProject = project;
        }
      }

      if (!incomingRequest.activeOrganization) {
        const organization = await organizationRepository.findById(targetDocument.organization_id);
        if (organization) {
          incomingRequest.activeOrganization = organization;
        }
      }

      nextMiddleware();
    } catch (middlewareError) {
      nextMiddleware(middlewareError);
    }
  };
};

/**
 * Middleware that restricts operations (e.g. document deletion) to
 * PROJECT_MANAGERs or the organization OWNER.
 */
export const requireDocumentManager = (
  incomingRequest: Request,
  _outgoingResponse: Response,
  nextMiddleware: NextFunction
): void => {
  if (!incomingRequest.isProjectManager) {
    return nextMiddleware(
      new ForbiddenError(
        'Insufficient permissions. Only a PROJECT_MANAGER or organization OWNER can perform this action.'
      )
    );
  }

  nextMiddleware();
};
