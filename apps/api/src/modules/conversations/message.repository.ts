import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  Message,
  MessageRole,
  MessageWithSources,
  SourceCitation,
} from './conversation.entity.js';

export class MessageRepository extends BaseRepository<Message> {
  protected readonly tableName = 'messages';

  /**
   * Creates a single message.
   */
  public async createMessage(
    data: {
      id?: string;
      conversation_id: string;
      role: MessageRole;
      content: string;
    },
    client?: PoolClient
  ): Promise<Message> {
    const sql = `
      INSERT INTO ${this.tableName} (
        ${data.id ? 'id, ' : ''}conversation_id, role, content
      )
      VALUES (
        ${data.id ? '$1, ' : ''}$${data.id ? '2' : '1'}, $${data.id ? '3' : '2'}, $${data.id ? '4' : '3'}
      )
      RETURNING *;
    `;
    const params = data.id
      ? [data.id, data.conversation_id, data.role, data.content]
      : [data.conversation_id, data.role, data.content];

    const rows = await this.query<Message>(sql, params, client);
    return rows[0];
  }

  /**
   * Bulk inserts source citations for an assistant message.
   */
  public async createMessageSources(
    sources: Array<{
      message_id: string;
      document_chunk_id: string;
      rank: number;
      similarity_score: number;
    }>,
    client?: PoolClient
  ): Promise<void> {
    if (!sources || sources.length === 0) {
      return;
    }

    const valueClauses = sources
      .map(
        (_, i) =>
          `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      )
      .join(', ');

    const params: (string | number)[] = [];
    for (const s of sources) {
      params.push(s.message_id, s.document_chunk_id, s.rank, s.similarity_score);
    }

    const sql = `
      INSERT INTO message_sources (message_id, document_chunk_id, rank, similarity_score)
      VALUES ${valueClauses};
    `;
    await this.query(sql, params, client);
  }

  /**
   * Lists chronological messages for a conversation, attaching enriched source citations.
   */
  public async listByConversationWithSources(
    conversationId: string,
    limit = 500,
    client?: PoolClient
  ): Promise<MessageWithSources[]> {
    // 1. Fetch messages
    // Take the NEWEST `limit` messages (not the oldest), then restore chronological order, so a long
    // conversation keeps showing its latest turns instead of freezing at its first ones.
    const messagesSql = `
      SELECT *
      FROM (
        SELECT *
        FROM ${this.tableName}
        WHERE conversation_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      ) recent
      ORDER BY created_at ASC, id ASC;
    `;
    const messages = await this.query<Message>(messagesSql, [conversationId, limit], client);
    if (messages.length === 0) {
      return [];
    }

    const assistantMessageIds = messages
      .filter((m) => m.role === 'ASSISTANT')
      .map((m) => m.id);

    if (assistantMessageIds.length === 0) {
      return messages.map((m) => ({ ...m, sources: [] }));
    }

    // 2. Fetch citations enriched with document & project metadata
    const sourcesSql = `
      SELECT
        ms.message_id,
        ms.document_chunk_id AS chunk_id,
        ms.rank,
        ms.similarity_score::float AS similarity_score,
        c.chunk_index,
        c.page_number,
        SUBSTRING(c.content FROM 1 FOR 300) AS excerpt,
        d.id AS document_id,
        d.name AS document_name,
        p.id AS project_id,
        p.name AS project_name
      FROM message_sources ms
      JOIN document_chunks c ON ms.document_chunk_id = c.id
      JOIN document_versions dv ON c.document_version_id = dv.id
      JOIN documents d ON dv.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE ms.message_id = ANY($1::uuid[])
      ORDER BY ms.rank ASC;
    `;

    interface SourceRow {
      message_id: string;
      chunk_id: string;
      rank: number;
      similarity_score: number;
      chunk_index: number;
      page_number: number | null;
      excerpt: string;
      document_id: string;
      document_name: string;
      project_id: string;
      project_name: string;
    }

    const sourceRows = await this.query<SourceRow>(sourcesSql, [assistantMessageIds], client);

    const sourcesByMessageId = new Map<string, SourceCitation[]>();
    for (const row of sourceRows) {
      const citation: SourceCitation = {
        chunk_id: row.chunk_id,
        document_id: row.document_id,
        document_name: row.document_name,
        project_id: row.project_id,
        project_name: row.project_name,
        chunk_index: row.chunk_index,
        page_number: row.page_number,
        similarity_score: row.similarity_score,
        excerpt: row.excerpt,
      };

      const existing = sourcesByMessageId.get(row.message_id) || [];
      existing.push(citation);
      sourcesByMessageId.set(row.message_id, existing);
    }

    return messages.map((m) => ({
      ...m,
      sources: sourcesByMessageId.get(m.id) || [],
    }));
  }

  /**
   * Fetches recent conversation messages for LLM prompt context window.
   */
  public async getRecentHistory(
    conversationId: string,
    limit = 6,
    client?: PoolClient
  ): Promise<Array<{ role: MessageRole; content: string }>> {
    const sql = `
      SELECT role, content
      FROM (
        SELECT role, content, created_at
        FROM ${this.tableName}
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      ) recent
      ORDER BY created_at ASC;
    `;
    return this.query<{ role: MessageRole; content: string }>(sql, [conversationId, limit], client);
  }
}

export const messageRepository = new MessageRepository();
