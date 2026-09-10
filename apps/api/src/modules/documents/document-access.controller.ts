import type { Request, Response, NextFunction } from 'express';
import {
  documentAccessService,
  type DocumentAccessService,
} from './document-access.service.js';
import type {
  UpdateDocumentAccessModeInput,
  SetUserAccessRuleInput,
  SetGroupAccessRuleInput,
  SetOrgRoleAccessRuleInput,
  SetProjectRoleAccessRuleInput,
} from './document-access.schema.js';
import type { OrganizationRole } from '../organizations/organization.entity.js';
import type { ProjectRole } from '../projects/project.entity.js';

export class DocumentAccessController {
  constructor(
    private readonly accessService: DocumentAccessService = documentAccessService
  ) {}

  /**
   * Updates document access mode between PROJECT and RESTRICTED.
   * Route: PATCH /api/v1/documents/:id/access-mode
   */
  public setAccessModeHandler = async (
    req: Request<{ id: string }, unknown, UpdateDocumentAccessModeInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;
      const { access_mode } = req.body;

      const updatedDoc = await this.accessService.setAccessMode(
        documentId,
        callerUserId,
        access_mode
      );

      res.status(200).json({
        success: true,
        data: { document: updatedDoc },
        message: `Document access mode updated to ${access_mode}.`,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves all access rules configured on a document.
   * Route: GET /api/v1/documents/:id/access-rules
   */
  public getDocumentRulesHandler = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;

      const rulesSummary = await this.accessService.getDocumentRules(
        documentId,
        callerUserId
      );

      res.status(200).json({
        success: true,
        data: rulesSummary,
        message: 'Document access rules retrieved successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Sets or updates an individual user access rule.
   * Route: POST /api/v1/documents/:id/access-rules/users
   */
  public setUserRuleHandler = async (
    req: Request<{ id: string }, unknown, SetUserAccessRuleInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;
      const { user_id, effect } = req.body;

      const rule = await this.accessService.setUserRule(
        documentId,
        callerUserId,
        user_id,
        effect
      );

      res.status(200).json({
        success: true,
        data: { rule },
        message: 'User access rule configured successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Removes an individual user access rule.
   * Route: DELETE /api/v1/documents/:id/access-rules/users/:userId
   */
  public deleteUserRuleHandler = async (
    req: Request<{ id: string; userId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: documentId, userId: targetUserId } = req.params;
      const callerUserId = req.authenticatedUser!.id;

      await this.accessService.deleteUserRule(
        documentId,
        callerUserId,
        targetUserId
      );

      res.status(200).json({
        success: true,
        message: 'User access rule removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Sets or updates a group access rule.
   * Route: POST /api/v1/documents/:id/access-rules/groups
   */
  public setGroupRuleHandler = async (
    req: Request<{ id: string }, unknown, SetGroupAccessRuleInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;
      const { group_id, effect } = req.body;

      const rule = await this.accessService.setGroupRule(
        documentId,
        callerUserId,
        group_id,
        effect
      );

      res.status(200).json({
        success: true,
        data: { rule },
        message: 'Group access rule configured successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Removes a group access rule.
   * Route: DELETE /api/v1/documents/:id/access-rules/groups/:groupId
   */
  public deleteGroupRuleHandler = async (
    req: Request<{ id: string; groupId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: documentId, groupId: targetGroupId } = req.params;
      const callerUserId = req.authenticatedUser!.id;

      await this.accessService.deleteGroupRule(
        documentId,
        callerUserId,
        targetGroupId
      );

      res.status(200).json({
        success: true,
        message: 'Group access rule removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Sets or updates an organization role access rule.
   * Route: POST /api/v1/documents/:id/access-rules/org-roles
   */
  public setOrgRoleRuleHandler = async (
    req: Request<{ id: string }, unknown, SetOrgRoleAccessRuleInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;
      const { role, effect } = req.body;

      const rule = await this.accessService.setOrgRoleRule(
        documentId,
        callerUserId,
        role as OrganizationRole,
        effect
      );

      res.status(200).json({
        success: true,
        data: { rule },
        message: 'Organization role access rule configured successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Removes an organization role access rule.
   * Route: DELETE /api/v1/documents/:id/access-rules/org-roles/:role
   */
  public deleteOrgRoleRuleHandler = async (
    req: Request<{ id: string; role: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: documentId, role } = req.params;
      const callerUserId = req.authenticatedUser!.id;

      await this.accessService.deleteOrgRoleRule(
        documentId,
        callerUserId,
        role as OrganizationRole
      );

      res.status(200).json({
        success: true,
        message: 'Organization role access rule removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Sets or updates a project role access rule.
   * Route: POST /api/v1/documents/:id/access-rules/project-roles
   */
  public setProjectRoleRuleHandler = async (
    req: Request<{ id: string }, unknown, SetProjectRoleAccessRuleInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const documentId = req.params.id;
      const callerUserId = req.authenticatedUser!.id;
      const { role, effect } = req.body;

      const rule = await this.accessService.setProjectRoleRule(
        documentId,
        callerUserId,
        role as ProjectRole,
        effect
      );

      res.status(200).json({
        success: true,
        data: { rule },
        message: 'Project role access rule configured successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Removes a project role access rule.
   * Route: DELETE /api/v1/documents/:id/access-rules/project-roles/:role
   */
  public deleteProjectRoleRuleHandler = async (
    req: Request<{ id: string; role: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: documentId, role } = req.params;
      const callerUserId = req.authenticatedUser!.id;

      await this.accessService.deleteProjectRoleRule(
        documentId,
        callerUserId,
        role as ProjectRole
      );

      res.status(200).json({
        success: true,
        message: 'Project role access rule removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  };
}

export const documentAccessController = new DocumentAccessController();
