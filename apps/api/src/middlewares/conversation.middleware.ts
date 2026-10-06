import type { Request, Response, NextFunction } from 'express';
import { conversationRepository } from '../modules/conversations/conversation.repository.js';
import { organizationRepository } from '../modules/organizations/organization.repository.js';
import { organizationMembershipRepository } from '../modules/organizations/organization-membership.repository.js';
import type { ConversationWithProjects } from '../modules/conversations/conversation.entity.js';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../errors/app-error.js';

// Augment Express Request interface with conversation context
declare global {
  namespace Express {
    interface Request {
      activeConversation?: ConversationWithProjects;
    }
  }
}

/**
 * Middleware enforcing that:
 * 1. The requested conversation exists.
 * 2. The user belongs to the conversation's organization.
 * 3. The user is either the conversation creator or an org OWNER/ADMIN.
 *
 * Attaches `req.activeConversation`, `req.activeOrganization`, and `req.organizationMembership`.
 */
export const requireConversationAccess = (paramKey = 'id') => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.authenticatedUser) {
        throw new UnauthorizedError('Authentication required to access conversation.');
      }

      const rawId = req.params[paramKey];
      const conversationId = Array.isArray(rawId) ? rawId[0] : rawId;

      if (!conversationId || typeof conversationId !== 'string') {
        throw new NotFoundError('Conversation identifier is required.');
      }

      const conversation = await conversationRepository.findByIdWithProjects(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found.');
      }

      const org = await organizationRepository.findById(conversation.organization_id);
      if (!org) {
        throw new NotFoundError('Parent organization not found.');
      }
      if (org.status === 'SUSPENDED') {
        throw new ForbiddenError(
          'This organization has been suspended by the platform administrator. Its data is preserved, but it cannot be used until it is reactivated.',
          { code: 'ORGANIZATION_SUSPENDED' }
        );
      }


      const membership = await organizationMembershipRepository.findByUserAndOrg(
        req.authenticatedUser.id,
        conversation.organization_id
      );

      if (!membership) {
        throw new ForbiddenError('You are not a member of this organization.');
      }

      // Check access: creator or OWNER/ADMIN
      const isCreator = conversation.created_by === req.authenticatedUser.id;
      const isPrivileged = membership.role === 'OWNER' || membership.role === 'ADMIN';

      if (!isCreator && !isPrivileged) {
        throw new ForbiddenError('You do not have access to this conversation.');
      }

      req.activeConversation = conversation;
      req.activeOrganization = org;
      req.organizationMembership = membership;

      next();
    } catch (err) {
      next(err);
    }
  };
};
