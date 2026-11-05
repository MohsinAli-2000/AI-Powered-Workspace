import { Router } from 'express';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { requireOrgMembership } from '../../middlewares/organization.middleware.js';
import { requireConversationAccess } from '../../middlewares/conversation.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { conversationController } from './conversation.controller.js';
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
} from './conversation.schema.js';

// ---------------------------------------------------------------------------
// 1. Organization-Scoped Conversation Router
// Mounted at: /api/v1/organizations
// ---------------------------------------------------------------------------
export const organizationConversationsRouter: Router = Router();

organizationConversationsRouter.use(authenticateUser);

/**
 * Route: POST /api/v1/organizations/:id/conversations
 * Description: Create a new conversation in an organization with optional project scoping
 * Access: Organization members
 */
organizationConversationsRouter.post(
  '/:id/conversations',
  requireOrgMembership('id'),
  validateRequest(createConversationSchema),
  conversationController.create
);

/**
 * Route: GET /api/v1/organizations/:id/conversations
 * Description: List user's conversations in an organization
 * Access: Organization members
 */
organizationConversationsRouter.get(
  '/:id/conversations',
  requireOrgMembership('id'),
  conversationController.list
);

// ---------------------------------------------------------------------------
// 2. Direct Conversation Router
// Mounted at: /api/v1/conversations
// ---------------------------------------------------------------------------
export const conversationRouter: Router = Router();

conversationRouter.use(authenticateUser);

/**
 * Route: GET /api/v1/conversations/:id
 * Description: Get conversation details with project scopes
 * Access: Conversation creator or organization OWNER/ADMIN
 */
conversationRouter.get(
  '/:id',
  requireConversationAccess('id'),
  conversationController.getById
);

/**
 * Route: PATCH /api/v1/conversations/:id
 * Description: Update conversation title
 * Access: Conversation creator or organization OWNER
 */
conversationRouter.patch(
  '/:id',
  requireConversationAccess('id'),
  validateRequest(updateConversationSchema),
  conversationController.update
);

/**
 * Route: DELETE /api/v1/conversations/:id
 * Description: Delete conversation and associated messages
 * Access: Conversation creator or organization OWNER
 */
conversationRouter.delete(
  '/:id',
  requireConversationAccess('id'),
  conversationController.delete
);

/**
 * Route: GET /api/v1/conversations/:id/messages
 * Description: List chronological messages with source citations
 * Access: Conversation creator or organization OWNER/ADMIN
 */
conversationRouter.get(
  '/:id/messages',
  requireConversationAccess('id'),
  conversationController.getMessages
);

/**
 * Route: POST /api/v1/conversations/:id/messages
 * Description: Send message and trigger RAG knowledge retrieval and grounded answer generation
 * Access: Conversation creator or organization OWNER/ADMIN
 */
conversationRouter.post(
  '/:id/messages',
  requireConversationAccess('id'),
  validateRequest(sendMessageSchema),
  conversationController.sendMessage
);

/**
 * Route: POST /api/v1/conversations/:id/messages/stream
 * Description: Same as POST /:id/messages, but streams the answer tokens via Server-Sent Events
 * Access: Conversation creator
 */
conversationRouter.post(
  '/:id/messages/stream',
  requireConversationAccess('id'),
  validateRequest(sendMessageSchema),
  conversationController.sendMessageStream
);
