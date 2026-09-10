import type { Request, Response, NextFunction } from 'express';
import { conversationService } from './conversation.service.js';
import {
  createConversationBodySchema,
  updateConversationBodySchema,
  sendMessageBodySchema,
  conversationIdParamSchema,
} from './conversation.schema.js';
import { UnauthorizedError } from '../../errors/app-error.js';

export class ConversationController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const dto = createConversationBodySchema.parse(req.body);
      const conversation = await conversationService.createConversation(
        req.authenticatedUser.id,
        req.activeOrganization.id,
        dto
      );

      res.status(201).json({
        status: 'success',
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const conversations = await conversationService.listConversations(
        req.authenticatedUser.id,
        req.activeOrganization.id
      );

      res.status(200).json({
        status: 'success',
        data: conversations,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      const conversation = await conversationService.getConversation(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id
      );

      res.status(200).json({
        status: 'success',
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      const dto = updateConversationBodySchema.parse(req.body);
      const conversation = await conversationService.updateConversation(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id,
        dto
      );

      res.status(200).json({
        status: 'success',
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      await conversationService.deleteConversation(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id
      );

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  public async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      const messages = await conversationService.getMessages(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id
      );

      res.status(200).json({
        status: 'success',
        data: messages,
      });
    } catch (err) {
      next(err);
    }
  }

  public async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      const dto = sendMessageBodySchema.parse(req.body);
      const message = await conversationService.sendMessage(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id,
        dto
      );

      res.status(201).json({
        status: 'success',
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const conversationController = new ConversationController();
