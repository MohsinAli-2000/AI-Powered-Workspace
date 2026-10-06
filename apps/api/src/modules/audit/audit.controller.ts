import type { Request, Response, NextFunction } from 'express';
import { auditService, type AuditService } from './audit.service.js';

export class AuditController {
  constructor(private readonly audService: AuditService = auditService) {}

  /**
   * Retrieves paginated audit logs for an organization.
   * Route: GET /api/v1/organizations/:id/audit-logs
   */
  public getLogsHandler = async (
    incomingRequest: Request,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const rawOrgId = incomingRequest.params.id;
      const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
      const query = incomingRequest.query as {
        page?: string;
        limit?: string;
        action?: string;
        resourceType?: string;
        actorUserId?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
      };

      const result = await this.audService.getOrganizationAuditLogs(organizationId, {
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 25,
        action: query.action,
        resourceType: query.resourceType,
        actorUserId: query.actorUserId,
        search: query.search,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      outgoingResponse.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Retrieves filter options (unique actions and resource types) for an organization.
   * Route: GET /api/v1/organizations/:id/audit-logs/filters
   */
  public getFilterOptionsHandler = async (
    incomingRequest: Request,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const rawOrgId = incomingRequest.params.id;
      const organizationId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;
      const options = await this.audService.getFilterOptions(organizationId);

      outgoingResponse.status(200).json({
        success: true,
        data: options,
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

export const auditController = new AuditController();
