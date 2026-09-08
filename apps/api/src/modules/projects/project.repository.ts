import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type { Project, ProjectWithMembership } from './project.entity.js';

export class ProjectRepository extends BaseRepository<Project> {
  protected readonly tableName = 'projects';

  /**
   * Creates a new project in the database.
   */
  public async create(
    projectData: {
      organization_id: string;
      name: string;
      description?: string | null;
      created_by?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<Project> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, name, description, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const createdRows = await this.query<Project>(
      sqlQuery,
      [
        projectData.organization_id,
        projectData.name.trim(),
        projectData.description ? projectData.description.trim() : null,
        projectData.created_by ?? null,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a project by ID and organization ID to prevent cross-tenant access.
   */
  public async findByIdAndOrg(
    projectId: string,
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<Project | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 AND organization_id = $2
      LIMIT 1;
    `;
    return this.queryOne<Project>(sqlQuery, [projectId, organizationId], databaseClient);
  }

  /**
   * Retrieves authorized projects for a user within an organization.
   * - If the user is the organization OWNER, returns all projects in the organization.
   * - Otherwise, returns only projects where the user holds an active project membership.
   */
  public async findAuthorizedByUserAndOrg(
    organizationId: string,
    userId: string,
    isOrgOwner: boolean,
    databaseClient?: PoolClient
  ): Promise<ProjectWithMembership[]> {
    if (isOrgOwner) {
      const sqlQuery = `
        SELECT
          p.*,
          COALESCE(pm_user.role, NULL) AS user_role,
          (SELECT COUNT(*)::int FROM project_memberships pm WHERE pm.project_id = p.id) AS member_count
        FROM ${this.tableName} p
        LEFT JOIN project_memberships pm_user
          ON pm_user.project_id = p.id AND pm_user.user_id = $2
        WHERE p.organization_id = $1
        ORDER BY p.created_at DESC;
      `;
      return this.query<ProjectWithMembership>(
        sqlQuery,
        [organizationId, userId],
        databaseClient
      );
    }

    const sqlQuery = `
      SELECT
        p.*,
        pm.role AS user_role,
        (SELECT COUNT(*)::int FROM project_memberships p_all WHERE p_all.project_id = p.id) AS member_count
      FROM ${this.tableName} p
      INNER JOIN project_memberships pm
        ON pm.project_id = p.id AND pm.user_id = $2
      WHERE p.organization_id = $1
      ORDER BY p.created_at DESC;
    `;
    return this.query<ProjectWithMembership>(
      sqlQuery,
      [organizationId, userId],
      databaseClient
    );
  }

  /**
   * Updates a project's editable fields (name and description).
   */
  public async update(
    projectId: string,
    updateData: {
      name?: string;
      description?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<Project | null> {
    const updateClauses: string[] = [];
    const queryParameters: unknown[] = [];
    let parameterIndex = 1;

    if (updateData.name !== undefined) {
      updateClauses.push(`name = $${parameterIndex++}`);
      queryParameters.push(updateData.name.trim());
    }

    if (updateData.description !== undefined) {
      updateClauses.push(`description = $${parameterIndex++}`);
      queryParameters.push(
        updateData.description ? updateData.description.trim() : null
      );
    }

    if (updateClauses.length === 0) {
      return this.findById(projectId, databaseClient);
    }

    updateClauses.push(`updated_at = NOW()`);
    queryParameters.push(projectId);

    const sqlQuery = `
      UPDATE ${this.tableName}
      SET ${updateClauses.join(', ')}
      WHERE id = $${parameterIndex}
      RETURNING *;
    `;
    return this.queryOne<Project>(sqlQuery, queryParameters, databaseClient);
  }

  /**
   * Deletes a project by ID.
   * Cascade delete rules handle dependent records in PostgreSQL.
   */
  public async delete(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const sqlQuery = `DELETE FROM ${this.tableName} WHERE id = $1;`;
    const rows = await this.query(sqlQuery, [projectId], databaseClient);
    return true;
  }
}

export const projectRepository = new ProjectRepository();
