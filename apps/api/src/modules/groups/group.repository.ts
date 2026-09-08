import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type { Group, GroupWithMeta } from './group.entity.js';

export class GroupRepository extends BaseRepository<Group> {
  protected readonly tableName = 'groups';

  /**
   * Creates a new group in an organization.
   */
  public async create(
    groupData: {
      organization_id: string;
      name: string;
      description?: string | null;
      created_by?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<Group> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, name, description, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const createdRows = await this.query<Group>(
      sqlQuery,
      [
        groupData.organization_id,
        groupData.name.trim(),
        groupData.description ? groupData.description.trim() : null,
        groupData.created_by ?? null,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a group by its primary key UUID.
   */
  public async findById(
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<Group | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1
      LIMIT 1;
    `;
    return this.queryOne<Group>(sqlQuery, [groupId], databaseClient);
  }

  /**
   * Finds a group by ID scoped to an organization.
   */
  public async findByIdAndOrg(
    groupId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<Group | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 AND organization_id = $2
      LIMIT 1;
    `;
    return this.queryOne<Group>(sqlQuery, [groupId, organizationId], databaseClient);
  }

  /**
   * Finds a group by case-insensitive name within an organization.
   * Used to prevent duplicate group names in the same organization.
   */
  public async findByNameAndOrg(
    name: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<Group | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE organization_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1;
    `;
    return this.queryOne<Group>(sqlQuery, [organizationId, name], databaseClient);
  }

  /**
   * Lists all groups within an organization, enriched with member counts
   * and indicating if the requesting user belongs to each group.
   */
  public async listByOrganization(
    organizationId: string,
    requestingUserId: string,
    databaseClient?: PoolClient
  ): Promise<GroupWithMeta[]> {
    const sqlQuery = `
      SELECT
        g.*,
        (SELECT COUNT(*)::int FROM group_memberships gm WHERE gm.group_id = g.id) AS member_count,
        EXISTS(
          SELECT 1 FROM group_memberships gm_user 
          WHERE gm_user.group_id = g.id AND gm_user.user_id = $2
        ) AS is_member
      FROM ${this.tableName} g
      WHERE g.organization_id = $1
      ORDER BY g.created_at ASC;
    `;
    return this.query<GroupWithMeta>(sqlQuery, [organizationId, requestingUserId], databaseClient);
  }

  /**
   * Retrieves a single group by ID with member count and requesting user membership flag.
   */
  public async getWithMetaById(
    groupId: string,
    requestingUserId: string,
    databaseClient?: PoolClient
  ): Promise<GroupWithMeta | null> {
    const sqlQuery = `
      SELECT
        g.*,
        (SELECT COUNT(*)::int FROM group_memberships gm WHERE gm.group_id = g.id) AS member_count,
        EXISTS(
          SELECT 1 FROM group_memberships gm_user 
          WHERE gm_user.group_id = g.id AND gm_user.user_id = $2
        ) AS is_member
      FROM ${this.tableName} g
      WHERE g.id = $1
      LIMIT 1;
    `;
    return this.queryOne<GroupWithMeta>(sqlQuery, [groupId, requestingUserId], databaseClient);
  }

  /**
   * Updates group name and/or description.
   */
  public async update(
    groupId: string,
    updateData: {
      name?: string;
      description?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<Group | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const queryParams: unknown[] = [groupId];

    if (updateData.name !== undefined) {
      queryParams.push(updateData.name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }

    if (updateData.description !== undefined) {
      queryParams.push(updateData.description ? updateData.description.trim() : null);
      setClauses.push(`description = $${queryParams.length}`);
    }

    const sqlQuery = `
      UPDATE ${this.tableName}
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    const updatedRows = await this.query<Group>(sqlQuery, queryParams, databaseClient);
    return updatedRows[0] ?? null;
  }

  /**
   * Deletes a group by ID.
   * Cascade delete on foreign keys will remove associated group_memberships.
   */
  public async delete(
    groupId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    return this.deleteById(groupId, databaseClient);
  }
}

export const groupRepository = new GroupRepository();
