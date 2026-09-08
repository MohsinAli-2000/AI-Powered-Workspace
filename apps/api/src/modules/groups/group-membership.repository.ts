import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type { GroupMembership, GroupMemberDetail } from './group.entity.js';

export class GroupMembershipRepository extends BaseRepository<GroupMembership> {
  protected readonly tableName = 'group_memberships';

  /**
   * Adds a user to a group.
   */
  public async create(
    membershipData: {
      organization_id: string;
      group_id: string;
      user_id: string;
    },
    databaseClient?: PoolClient
  ): Promise<GroupMembership> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, group_id, user_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const createdRows = await this.query<GroupMembership>(
      sqlQuery,
      [
        membershipData.organization_id,
        membershipData.group_id,
        membershipData.user_id,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a user's membership in a group.
   */
  public async findByUserAndGroup(
    userId: string,
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<GroupMembership | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND group_id = $2
      LIMIT 1;
    `;
    return this.queryOne<GroupMembership>(
      sqlQuery,
      [userId, groupId],
      databaseClient
    );
  }

  /**
   * Retrieves all members of a group with user profile information and organization role.
   */
  public async findGroupMembers(
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<GroupMemberDetail[]> {
    const sqlQuery = `
      SELECT
        gm.id,
        gm.group_id,
        gm.user_id,
        u.name,
        u.email,
        COALESCE(om.role, 'MEMBER') AS org_role,
        gm.created_at AS joined_at
      FROM ${this.tableName} gm
      INNER JOIN users u ON u.id = gm.user_id
      LEFT JOIN organization_memberships om
        ON om.user_id = gm.user_id AND om.organization_id = gm.organization_id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at ASC;
    `;
    return this.query<GroupMemberDetail>(sqlQuery, [groupId], databaseClient);
  }

  /**
   * Removes a member from a group.
   */
  public async deleteByUserAndGroup(
    userId: string,
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const sqlQuery = `
      DELETE FROM ${this.tableName}
      WHERE user_id = $1 AND group_id = $2
      RETURNING id;
    `;
    const rows = await this.query(
      sqlQuery,
      [userId, groupId],
      databaseClient
    );
    return rows.length > 0;
  }

  /**
   * Counts the number of active members in a group.
   */
  public async countByGroup(
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<number> {
    const sqlQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${this.tableName}
      WHERE group_id = $1;
    `;
    const rows = await this.query<{ total: number }>(sqlQuery, [groupId], databaseClient);
    return rows[0]?.total ?? 0;
  }

  /**
   * Retrieves all group IDs a user belongs to within an organization.
   */
  public async listUserGroupIds(
    userId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<string[]> {
    const sqlQuery = `
      SELECT group_id
      FROM ${this.tableName}
      WHERE user_id = $1 AND organization_id = $2;
    `;
    const rows = await this.query<{ group_id: string }>(
      sqlQuery,
      [userId, organizationId],
      databaseClient
    );
    return rows.map((r) => r.group_id);
  }
}

export const groupMembershipRepository = new GroupMembershipRepository();
