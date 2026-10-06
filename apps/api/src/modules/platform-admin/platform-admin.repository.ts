import { pool } from '../../db/pool.js';
import type { Organization, OrganizationStatus } from '../organizations/organization.entity.js';
import { organizationRepository } from '../organizations/organization.repository.js';

/**
 * Privacy boundary: everything this repository returns is organization *metadata* and aggregate counts.
 * It never selects document names, file names, chunk text, messages, member lists or group names.
 * Only the OWNER's name and email are exposed, as the accountable contact for the organization.
 */
export interface AdminOrganizationSummary {
  id: string;
  name: string;
  status: OrganizationStatus;
  created_at: Date;
  suspended_at: Date | null;
  suspension_reason: string | null;
  owner_name: string | null;
  owner_email: string | null;
  member_count: number;
  project_count: number;
  document_count: number;
  storage_bytes: number;
}

export interface AdminPlatformStats {
  total_organizations: number;
  active_organizations: number;
  suspended_organizations: number;
  total_users: number;
  total_documents: number;
  total_storage_bytes: number;
}

export interface ListOrganizationsFilter {
  search?: string;
  status?: OrganizationStatus;
  page: number;
  limit: number;
}

export class PlatformAdminRepository {
  public async getStats(): Promise<AdminPlatformStats> {
    const { rows } = await pool.query<AdminPlatformStats>(`
      SELECT
        (SELECT COUNT(*)::int FROM organizations) AS total_organizations,
        (SELECT COUNT(*)::int FROM organizations WHERE status = 'ACTIVE') AS active_organizations,
        (SELECT COUNT(*)::int FROM organizations WHERE status = 'SUSPENDED') AS suspended_organizations,
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM documents) AS total_documents,
        (SELECT COALESCE(SUM(file_size), 0)::bigint FROM document_versions) AS total_storage_bytes;
    `);
    const stats = rows[0];
    // pg returns BIGINT as a string; storage totals fit comfortably in a JS number.
    return { ...stats, total_storage_bytes: Number(stats.total_storage_bytes) };
  }

  public async listOrganizations(
    filter: ListOrganizationsFilter
  ): Promise<{ organizations: AdminOrganizationSummary[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      conditions.push(`(o.name ILIKE $${params.length} OR owner_u.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromClause = `
      FROM organizations o
      LEFT JOIN organization_memberships owner_m
        ON owner_m.organization_id = o.id AND owner_m.role = 'OWNER'
      LEFT JOIN users owner_u ON owner_u.id = owner_m.user_id
      ${where}
    `;

    const countResult = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total ${fromClause};`,
      params
    );

    const offset = (filter.page - 1) * filter.limit;
    const listParams = [...params, filter.limit, offset];
    const { rows } = await pool.query<AdminOrganizationSummary>(
      `
      SELECT
        o.id,
        o.name,
        o.status,
        o.created_at,
        o.suspended_at,
        o.suspension_reason,
        owner_u.name AS owner_name,
        owner_u.email AS owner_email,
        (SELECT COUNT(*)::int FROM organization_memberships m WHERE m.organization_id = o.id) AS member_count,
        (SELECT COUNT(*)::int FROM projects p WHERE p.organization_id = o.id) AS project_count,
        (SELECT COUNT(*)::int FROM documents d WHERE d.organization_id = o.id) AS document_count,
        (SELECT COALESCE(SUM(v.file_size), 0)::bigint
           FROM document_versions v
           INNER JOIN documents d ON d.id = v.document_id
          WHERE d.organization_id = o.id) AS storage_bytes
      ${fromClause}
      ORDER BY o.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length};
      `,
      listParams
    );

    return {
      organizations: rows.map((row) => ({ ...row, storage_bytes: Number(row.storage_bytes) })),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  public async findOrganization(organizationId: string): Promise<Organization | null> {
    const { rows } = await pool.query<Organization>(
      'SELECT * FROM organizations WHERE id = $1 LIMIT 1;',
      [organizationId]
    );
    return rows[0] ?? null;
  }

  public async setStatus(
    organizationId: string,
    status: OrganizationStatus,
    adminUserId: string,
    reason: string | null
  ): Promise<Organization | null> {
    const { rows } =
      status === 'SUSPENDED'
        ? await pool.query<Organization>(
            `UPDATE organizations
                SET status = 'SUSPENDED', suspended_at = NOW(), suspended_by = $2,
                    suspension_reason = $3, updated_at = NOW()
              WHERE id = $1
              RETURNING *;`,
            [organizationId, adminUserId, reason]
          )
        : await pool.query<Organization>(
            `UPDATE organizations
                SET status = 'ACTIVE', suspended_at = NULL, suspended_by = NULL,
                    suspension_reason = NULL, updated_at = NOW()
              WHERE id = $1
              RETURNING *;`,
            [organizationId]
          );
    return rows[0] ?? null;
  }

  public async getOrganizationOwner(
    organizationId: string
  ): Promise<{ id: string; name: string; email: string } | null> {
    const { rows } = await pool.query<{ id: string; name: string; email: string }>(
      `SELECT u.id, u.name, u.email
         FROM organization_memberships om
         JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1 AND om.role = 'OWNER'
        LIMIT 1;`,
      [organizationId]
    );
    return rows[0] ?? null;
  }

  public async deleteOrganization(organizationId: string): Promise<boolean> {
    return organizationRepository.deleteById(organizationId);
  }
}



export const platformAdminRepository = new PlatformAdminRepository();
