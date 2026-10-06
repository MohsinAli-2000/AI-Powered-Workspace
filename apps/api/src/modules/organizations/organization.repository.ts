import { BaseRepository } from '../../db/base.repository.js';
import { pool, type PoolClient } from '../../db/pool.js';
import type { Organization, OrganizationWithRole } from './organization.entity.js';

export class OrganizationRepository extends BaseRepository<Organization> {
  protected readonly tableName = 'organizations';

  /**
   * Creates a new organization record.
   */
  public async create(
    organizationData: { name: string },
    databaseClient?: PoolClient
  ): Promise<Organization> {
    const sqlQuery = `
      INSERT INTO ${this.tableName} (name)
      VALUES ($1)
      RETURNING *;
    `;
    const createdRows = await this.query<Organization>(
      sqlQuery,
      [organizationData.name],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Updates an organization's name and updated_at timestamp.
   */
  public async updateName(
    organizationId: string,
    updatedName: string,
    databaseClient?: PoolClient
  ): Promise<Organization | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    return this.queryOne<Organization>(sqlQuery, [updatedName, organizationId], databaseClient);
  }

  /**
   * Finds all organizations in which the user holds an active membership,
   * along with the user's role and the total member count.
   */
  public async findUserOrganizations(
    userId: string,
    databaseClient?: PoolClient
  ): Promise<OrganizationWithRole[]> {
    // Suspended organizations stay in the list (with status and reason) so members are told why they are
    // locked out instead of the organization silently disappearing.
    const sqlQuery = `
      SELECT 
        o.id,
        o.name,
        o.status,
        o.suspended_at,
        o.suspension_reason,
        o.created_at,
        o.updated_at,
        om.role AS user_role,
        COUNT(all_m.id)::int AS member_count
      FROM ${this.tableName} o
      INNER JOIN organization_memberships om ON om.organization_id = o.id
      LEFT JOIN organization_memberships all_m ON all_m.organization_id = o.id
      WHERE om.user_id = $1
      GROUP BY o.id, om.role
      ORDER BY o.created_at DESC;
    `;
    return this.query<OrganizationWithRole>(sqlQuery, [userId], databaseClient);
  }

  /**
   * Counts total active members in an organization.
   */
  public async getMemberCount(
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<number> {
    const sqlQuery = `
      SELECT COUNT(*)::int AS total_members
      FROM organization_memberships
      WHERE organization_id = $1;
    `;
    const countRow = await this.queryOne<{ total_members: number }>(
      sqlQuery,
      [organizationId],
      databaseClient
    );
    return countRow?.total_members ?? 0;
  }

  /**
   * Deletes an organization and allows authorized audit_logs cascade deletion.
   */
  public override async deleteById(
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const client = databaseClient ?? (await pool.connect());
    const isNewClient = !databaseClient;
    try {
      if (isNewClient) await client.query('BEGIN');
      await client.query("SET LOCAL app.allow_audit_log_purge = 'on';");
      const result = await client.query('DELETE FROM organizations WHERE id = $1;', [organizationId]);
      if (isNewClient) await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      if (isNewClient) await client.query('ROLLBACK');
      throw error;
    } finally {
      if (isNewClient) client.release();
    }
  }
}

export const organizationRepository = new OrganizationRepository();

