import { BaseRepository } from '../../db/base.repository.js';
import { type PoolClient } from '../../db/pool.js';
import type {
  OrganizationMembership,
  OrganizationMemberDetail,
  OrganizationRole,
} from './organization.entity.js';

export class OrganizationMembershipRepository extends BaseRepository<OrganizationMembership> {
  protected readonly tableName = 'organization_memberships';

  /**
   * Creates a new organization membership record.
   */
  public async create(
    membershipData: {
      organization_id: string;
      user_id: string;
      role: OrganizationRole;
    },
    databaseClient?: PoolClient
  ): Promise<OrganizationMembership> {
    const sqlQuery = `
      INSERT INTO ${this.tableName} (organization_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const createdRows = await this.query<OrganizationMembership>(
      sqlQuery,
      [membershipData.organization_id, membershipData.user_id, membershipData.role],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a user's membership in a specific organization.
   */
  public async findByUserAndOrg(
    userId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<OrganizationMembership | null> {
    // Every tenant access check (org, project, document, group and conversation middlewares and services)
    // goes through this lookup, so filtering out SUSPENDED organizations here is what locks members out
    // of a suspended organization everywhere at once.
    const sqlQuery = `
      SELECT m.* FROM ${this.tableName} m
      INNER JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = $1 AND m.organization_id = $2 AND o.status = 'ACTIVE'
      LIMIT 1;
    `;
    return this.queryOne<OrganizationMembership>(
      sqlQuery,
      [userId, organizationId],
      databaseClient
    );
  }

  /**
   * Lists all members of an organization with their user profiles and roles.
   */
  public async findMembersByOrg(
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<OrganizationMemberDetail[]> {
    const sqlQuery = `
      SELECT 
        om.id AS membership_id,
        om.user_id,
        u.name,
        u.email,
        om.role,
        om.created_at AS joined_at
      FROM ${this.tableName} om
      INNER JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1
      ORDER BY 
        CASE om.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
          WHEN 'MEMBER' THEN 3
        END ASC,
        om.created_at ASC;
    `;
    return this.query<OrganizationMemberDetail>(sqlQuery, [organizationId], databaseClient);
  }

  /**
   * Updates an existing member's organization role.
   */
  public async updateRole(
    membershipId: string,
    newRole: OrganizationRole,
    databaseClient?: PoolClient
  ): Promise<OrganizationMembership | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET role = $1
      WHERE id = $2
      RETURNING *;
    `;
    return this.queryOne<OrganizationMembership>(sqlQuery, [newRole, membershipId], databaseClient);
  }

  /**
   * Counts the number of members holding a specific role in an organization.
   */
  public async countByRole(
    organizationId: string,
    role: OrganizationRole,
    databaseClient?: PoolClient
  ): Promise<number> {
    const sqlQuery = `
      SELECT COUNT(*)::int AS total_count
      FROM ${this.tableName}
      WHERE organization_id = $1 AND role = $2;
    `;
    const countRow = await this.queryOne<{ total_count: number }>(
      sqlQuery,
      [organizationId, role],
      databaseClient
    );
    return countRow?.total_count ?? 0;
  }

  /**
   * Removes a user's membership from an organization.
   */
  public async deleteByUserAndOrg(
    userId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const sqlQuery = `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1 AND organization_id = $2;
    `;
    const { rowCount } = await this.execute(sqlQuery, [userId, organizationId], databaseClient);
    return rowCount > 0;
  }
}

export const organizationMembershipRepository = new OrganizationMembershipRepository();
