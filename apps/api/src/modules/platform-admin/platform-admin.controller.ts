import type { Request, Response, NextFunction } from 'express';
import { platformAdminService, type PlatformAdminService } from './platform-admin.service.js';

const paramId = (request: Request): string => {
  const raw = request.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
};

export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService = platformAdminService) {}

  /** GET /api/v1/admin/stats */
  public getStatsHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.service.getStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/v1/admin/organizations */
  public listOrganizationsHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as {
        page?: number;
        limit?: number;
        search?: string;
        status?: 'ACTIVE' | 'SUSPENDED';
      };
      const result = await this.service.listOrganizations({
        page: Number(query.page ?? 1),
        limit: Number(query.limit ?? 20),
        search: query.search || undefined,
        status: query.status,
      });
      res.status(200).json({
        success: true,
        data: result.organizations,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/v1/admin/organizations/:id/suspend */
  public suspendHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reason = (req.body as { reason?: string } | undefined)?.reason?.trim() || null;
      const organization = await this.service.suspendOrganization(
        paramId(req),
        req.authenticatedUser!.id,
        reason
      );
      res.status(200).json({
        success: true,
        message: `"${organization.name}" has been suspended.`,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/v1/admin/organizations/:id/reactivate */
  public reactivateHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organization = await this.service.reactivateOrganization(
        paramId(req),
        req.authenticatedUser!.id
      );
      res.status(200).json({
        success: true,
        message: `"${organization.name}" has been reactivated.`,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /api/v1/admin/organizations/:id */
  public deleteOrganizationHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.service.deleteSuspendedOrganization(
        paramId(req),
        req.authenticatedUser!.id
      );
      res.status(200).json({
        success: true,
        message: `Organization "${result.name}" and all associated data have been permanently deleted.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}


export const platformAdminController = new PlatformAdminController();
