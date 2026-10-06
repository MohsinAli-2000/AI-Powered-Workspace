import { logger } from '../../utils/logger.js';
import type { PoolClient } from '../../db/pool.js';
import {
  auditRepository,
  type AuditRepository,
} from './audit.repository.js';
import type {
  AuditLog,
  AuditLogWithActor,
  CreateAuditLogInput,
  AuditLogFilterOptions,
} from './audit.entity.js';

export interface PaginatedAuditLogs {
  logs: AuditLogWithActor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AuditService {
  constructor(private readonly repo: AuditRepository = auditRepository) {}

  /**
   * Safely records an audit event. Errors are trapped and logged so business transactions are never aborted.
   */
  public async record(
    input: CreateAuditLogInput,
    client?: PoolClient
  ): Promise<AuditLog | null> {
    // Inside a caller's transaction, a failed INSERT would put the whole transaction in an aborted state and
    // the final COMMIT would silently roll everything back. A savepoint confines the failure to this insert.
    const savepoint = client ? 'audit_record_sp' : null;
    try {
      if (client && savepoint) await client.query(`SAVEPOINT ${savepoint}`);
      const entry = await this.repo.create(input, client);
      if (client && savepoint) await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      logger.info(
        {
          auditId: entry.id,
          orgId: entry.organization_id,
          action: entry.action,
          actor: entry.actor_user_id,
          resource: `${entry.resource_type}:${entry.resource_id ?? 'none'}`,
        },
        '📜 [AUDIT EVENT RECORDED]'
      );
      return entry;
    } catch (error) {
      if (client && savepoint) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        } catch {
          // Connection is gone; the surrounding transaction will fail on its own.
        }
      }
      logger.warn(
        { error, input },
        '⚠️ Failed to record audit log event (non-fatal, proceeding)'
      );
      return null;
    }
  }

  /**
   * Retrieves paginated audit logs for an organization.
   */
  public async getOrganizationAuditLogs(
    organizationId: string,
    filters: AuditLogFilterOptions = {}
  ): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));

    const { logs, total } = await this.repo.findManyByOrganization(
      organizationId,
      { ...filters, page, limit }
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves list of available actions and resource types in this organization for UI filter options.
   */
  public async getFilterOptions(
    organizationId: string
  ): Promise<{ actions: string[]; resourceTypes: string[] }> {
    return this.repo.getDistinctFilterValues(organizationId);
  }
}

export const auditService = new AuditService();
