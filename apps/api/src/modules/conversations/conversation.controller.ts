import type { Request, Response, NextFunction } from 'express';
import { conversationService } from './conversation.service.js';
import {
  createConversationBodySchema,
  updateConversationBodySchema,
  sendMessageBodySchema,
  conversationIdParamSchema,
} from './conversation.schema.js';
import { AppError, UnauthorizedError } from '../../errors/app-error.js';
import { logger } from '../../utils/logger.js';

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

  /**
   * Streaming send (Server-Sent Events):
   *   event: token  data: {"token": "..."}           (zero or more)
   *   event: done   data: {"message": <saved message with sources>}
   *   event: error  data: {"message": "...", "statusCode": 503}
   * The SSE response starts with the first token or the final event, so access/validation errors raised
   * before that still go through the normal JSON error handler with their proper HTTP status.
   */
  public async sendMessageStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    let streamStarted = false;
    const startStream = () => {
      if (streamStarted) return;
      streamStarted = true;
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    };
    const send = (event: string, data: unknown) => {
      startStream();
      // The browser may have left; the answer is still generated and saved, like the non-streaming route.
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (!req.authenticatedUser || !req.activeOrganization) {
        throw new UnauthorizedError('Authentication and organization context required.');
      }

      const { id: conversationId } = conversationIdParamSchema.parse(req.params);
      const dto = sendMessageBodySchema.parse(req.body);
      const message = await conversationService.sendMessageStream(
        conversationId,
        req.authenticatedUser.id,
        req.activeOrganization.id,
        dto,
        (token) => send('token', { token })
      );

      send('done', { message });
      if (!res.writableEnded) res.end();
    } catch (err) {
      if (!streamStarted) {
        next(err);
        return;
      }
      logger.error({ err }, 'Streaming message failed after the response started');
      const isAppError = err instanceof AppError;
      send('error', {
        message: isAppError ? err.message : 'An unexpected error occurred. Please try again.',
        statusCode: isAppError ? err.statusCode : 500,
      });
      if (!res.writableEnded) res.end();
    }
  }
}

export const conversationController = new ConversationController();
