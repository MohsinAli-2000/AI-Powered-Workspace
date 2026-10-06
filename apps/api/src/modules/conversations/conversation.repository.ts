import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  Conversation,
  ConversationWithProjects,
} from './conversation.entity.js';

export class ConversationRepository extends BaseRepository<Conversation> {
  protected readonly tableName = 'conversations';

  /**
   * Creates a new conversation and maps optional project scopes.
   */
  public async create(
    data: {
      id?: string;
      organization_id: string;
      created_by: string;
      title?: string | null;
      project_ids?: string[];
    },
    client?: PoolClient
  ): Promise<ConversationWithProjects> {
    const execute = async (dbClient: PoolClient): Promise<ConversationWithProjects> => {
      const insertSql = `
        INSERT INTO ${this.tableName} (
          ${data.id ? 'id, ' : ''}organization_id, created_by, title
        )
        VALUES (
          ${data.id ? '$1, ' : ''}$${data.id ? '2' : '1'}, $${data.id ? '3' : '2'}, $${data.id ? '4' : '3'}
        )
        RETURNING *;
      `;
      const params = data.id
        ? [data.id, data.organization_id, data.created_by, data.title ?? null]
        : [data.organization_id, data.created_by, data.title ?? null];

      const rows = await this.query<Conversation>(insertSql, params, dbClient);
      const conversation = rows[0];

      const projectIds = data.project_ids ?? [];
      if (projectIds.length > 0) {
        // Insert into conversation_projects
        const valuesStatements = projectIds
          .map((_, idx) => `($1, $${idx + 2}, $${projectIds.length + 2})`)
          .join(', ');
        const projectInsertSql = `
          INSERT INTO conversation_projects (conversation_id, project_id, organization_id)
          VALUES ${valuesStatements}
          ON CONFLICT DO NOTHING;
        `;
        await this.query(
          projectInsertSql,
          [conversation.id, ...projectIds, data.organization_id],
          dbClient
        );
      }

      return {
        ...conversation,
        project_ids: projectIds,
      };
    };

    if (client) {
      return execute(client);
    }
    return BaseRepository.withTransaction(execute);
  }

  /**
   * Finds a conversation by ID, enriched with its configured project scopes.
   */
  public async findByIdWithProjects(
    id: string,
    client?: PoolClient
  ): Promise<ConversationWithProjects | null> {
    const sql = `
      SELECT
        c.*,
        COALESCE(
          array_agg(cp.project_id) FILTER (WHERE cp.project_id IS NOT NULL),
          '{}'
        ) AS project_ids
      FROM ${this.tableName} c
      LEFT JOIN conversation_projects cp ON c.id = cp.conversation_id
      WHERE c.id = $1
      GROUP BY c.id;
    `;
    const rows = await this.query<ConversationWithProjects>(sql, [id], client);
    return rows[0] ?? null;
  }

  /**
   * Lists all conversations created by a specific user within an organization.
   */
  public async listByUserAndOrg(
    userId: string,
    orgId: string,
    client?: PoolClient
  ): Promise<ConversationWithProjects[]> {
    const sql = `
      SELECT
        c.*,
        COALESCE(
          array_agg(cp.project_id) FILTER (WHERE cp.project_id IS NOT NULL),
          '{}'
        ) AS project_ids
      FROM ${this.tableName} c
      LEFT JOIN conversation_projects cp ON c.id = cp.conversation_id
      WHERE c.organization_id = $1 AND c.created_by = $2
      GROUP BY c.id
      ORDER BY c.updated_at DESC;
    `;
    return this.query<ConversationWithProjects>(sql, [orgId, userId], client);
  }

  /**
   * Updates conversation title and refreshes updated_at timestamp.
   */
  public async updateTitle(
    id: string,
    title: string,
    client?: PoolClient
  ): Promise<Conversation | null> {
    const sql = `
      UPDATE ${this.tableName}
      SET title = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    return this.queryOne<Conversation>(sql, [title.trim(), id], client);
  }

  /**
   * Updates the updated_at timestamp of a conversation.
   */
  public async touch(id: string, client?: PoolClient): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET updated_at = NOW()
      WHERE id = $1;
    `;
    await this.query(sql, [id], client);
  }

  /**
   * Deletes a conversation by ID.
   */
  public async delete(id: string, client?: PoolClient): Promise<boolean> {
    const { rowCount } = await this.execute(`DELETE FROM ${this.tableName} WHERE id = $1;`, [id], client);
    return rowCount > 0;
  }
}

export const conversationRepository = new ConversationRepository();
