import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  ProjectMembership,
  ProjectMemberDetail,
  ProjectRole,
} from './project.entity.js';

export class ProjectMembershipRepository extends BaseRepository<ProjectMembership> {
  protected readonly tableName = 'project_memberships';

  /**
   * Creates a project membership record.
   */
  public async create(
    membershipData: {
      organization_id: string;
      project_id: string;
      user_id: string;
      role: ProjectRole;
    },
    databaseClient?: PoolClient
  ): Promise<ProjectMembership> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, project_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const createdRows = await this.query<ProjectMembership>(
      sqlQuery,
      [
        membershipData.organization_id,
        membershipData.project_id,
        membershipData.user_id,
        membershipData.role,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a user's membership in a specific project.
   */
  public async findByUserAndProject(
    userId: string,
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<ProjectMembership | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND project_id = $2
      LIMIT 1;
    `;
    return this.queryOne<ProjectMembership>(
      sqlQuery,
      [userId, projectId],
      databaseClient
    );
  }

  /**
   * Retrieves all members of a project joined with user profile information.
   * Sorts PROJECT_MANAGERs first, then by joined date.
   */
  public async findProjectMembers(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<ProjectMemberDetail[]> {
    const sqlQuery = `
      SELECT
        pm.id,
        pm.project_id,
        pm.user_id,
        pm.role,
        u.name,
        u.email,
        pm.created_at
      FROM ${this.tableName} pm
      INNER JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY
        CASE WHEN pm.role = 'PROJECT_MANAGER' THEN 1 ELSE 2 END,
        pm.created_at ASC;
    `;
    return this.query<ProjectMemberDetail>(sqlQuery, [projectId], databaseClient);
  }

  /**
   * Counts the number of active PROJECT_MANAGERs in a project.
   * Used to enforce FR-PROJ-009 (Project Manager Minimum Count Rule).
   */
  public async countProjectManagers(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<number> {
    const sqlQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${this.tableName}
      WHERE project_id = $1 AND role = 'PROJECT_MANAGER';
    `;
    const result = await this.queryOne<{ total: number }>(
      sqlQuery,
      [projectId],
      databaseClient
    );
    return result?.total ?? 0;
  }

  /**
   * Counts the total number of members in a project.
   */
  public async countMembers(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<number> {
    const sqlQuery = `
      SELECT COUNT(*)::int AS total
      FROM ${this.tableName}
      WHERE project_id = $1;
    `;
    const result = await this.queryOne<{ total: number }>(
      sqlQuery,
      [projectId],
      databaseClient
    );
    return result?.total ?? 0;
  }

  /**
   * Updates a member's role within a project.
   */
  public async updateRole(
    projectId: string,
    userId: string,
    newRole: ProjectRole,
    databaseClient?: PoolClient
  ): Promise<ProjectMembership | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET role = $1, updated_at = NOW()
      WHERE project_id = $2 AND user_id = $3
      RETURNING *;
    `;
    return this.queryOne<ProjectMembership>(
      sqlQuery,
      [newRole, projectId, userId],
      databaseClient
    );
  }

  /**
   * Removes a member from a project.
   */
  public async delete(
    projectId: string,
    userId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const sqlQuery = `
      DELETE FROM ${this.tableName}
      WHERE project_id = $1 AND user_id = $2;
    `;
    await this.query(sqlQuery, [projectId, userId], databaseClient);
    return true;
  }
}

export const projectMembershipRepository = new ProjectMembershipRepository();
