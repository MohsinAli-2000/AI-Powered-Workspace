import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  AuditLog,
  AuditLogWithActor,
  CreateAuditLogInput,
  AuditLogFilterOptions,
} from './audit.entity.js';

export class AuditRepository extends BaseRepository<AuditLog> {
  protected readonly tableName = 'audit_logs';

  /**
   * Appends an immutable audit log record to the database.
   */
  public async create(
    input: CreateAuditLogInput,
    client?: PoolClient
  ): Promise<AuditLog> {
    const sql = `
      INSERT INTO audit_logs (
        organization_id,
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const params = [
      input.organizationId,
      input.actorUserId ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ];

    const result = await this.queryOne<AuditLog>(sql, params, client);
    if (!result) {
      throw new Error('Failed to insert audit log entry.');
    }
    return result;
  }

  /**
   * Retrieves paginated audit logs for an organization with optional filtering and actor joins.
   */
  public async findManyByOrganization(
    organizationId: string,
    filters: AuditLogFilterOptions = {}
  ): Promise<{ logs: AuditLogWithActor[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['al.organization_id = $1'];
    const queryParams: unknown[] = [organizationId];
    let paramIndex = 2;

    if (filters.action && filters.action.trim() !== '') {
      whereClauses.push(`al.action = $${paramIndex}`);
      queryParams.push(filters.action.trim());
      paramIndex++;
    }

    if (filters.resourceType && filters.resourceType.trim() !== '') {
      whereClauses.push(`al.resource_type = $${paramIndex}`);
      queryParams.push(filters.resourceType.trim());
      paramIndex++;
    }

    if (filters.actorUserId && filters.actorUserId.trim() !== '') {
      whereClauses.push(`al.actor_user_id = $${paramIndex}`);
      queryParams.push(filters.actorUserId.trim());
      paramIndex++;
    }

    if (filters.startDate) {
      whereClauses.push(`al.created_at >= $${paramIndex}`);
      queryParams.push(new Date(filters.startDate));
      paramIndex++;
    }

    if (filters.endDate) {
      whereClauses.push(`al.created_at <= $${paramIndex}`);
      queryParams.push(new Date(filters.endDate));
      paramIndex++;
    }

    if (filters.search && filters.search.trim() !== '') {
      const searchPattern = `%${filters.search.trim()}%`;
      whereClauses.push(
        `(al.action ILIKE $${paramIndex} OR al.resource_type ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      );
      queryParams.push(searchPattern);
      paramIndex++;
    }

    const whereSql = whereClauses.join(' AND ');

    // Count total matching records
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE ${whereSql};
    `;
    const countResult = await this.query<{ count: number }>(countSql, queryParams);
    const total = countResult[0]?.count ?? 0;

    // Fetch paginated records with actor join
    const dataSql = `
      SELECT 
        al.id,
        al.organization_id,
        al.actor_user_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.metadata,
        al.created_at,
        CASE 
          WHEN u.id IS NOT NULL THEN json_build_object('id', u.id, 'name', u.name, 'email', u.email)
          ELSE NULL
        END AS actor
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const logs = await this.query<AuditLogWithActor>(dataSql, [
      ...queryParams,
      limit,
      offset,
    ]);

    return { logs, total };
  }

  /**
   * Retrieves unique action names and resource types for filter dropdowns.
   */
  public async getDistinctFilterValues(
    organizationId: string
  ): Promise<{ actions: string[]; resourceTypes: string[] }> {
    const actionsSql = `
      SELECT DISTINCT action
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY action ASC;
    `;
    const resourceTypesSql = `
      SELECT DISTINCT resource_type
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY resource_type ASC;
    `;

    const [actionRows, resourceRows] = await Promise.all([
      this.query<{ action: string }>(actionsSql, [organizationId]),
      this.query<{ resource_type: string }>(resourceTypesSql, [organizationId]),
    ]);

    return {
      actions: actionRows.map((r) => r.action),
      resourceTypes: resourceRows.map((r) => r.resource_type),
    };
  }
}

export const auditRepository = new AuditRepository();
