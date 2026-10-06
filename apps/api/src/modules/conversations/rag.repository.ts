import { BaseRepository } from '../../db/base.repository.js';
import { pool, type PoolClient } from '../../db/pool.js';
import type { RetrievedChunk } from './conversation.entity.js';

export class RagRepository extends BaseRepository<RetrievedChunk> {
  protected readonly tableName = 'document_chunks';

  /**
   * Performs authorization-aware vector similarity search across document chunks.
   *
   * Security & Integrity Guarantees:
   * 1. Tenant Isolation: strictly filters by organization_id.
   * 2. Project Boundary: strictly filters by the user's authorized project IDs.
   * 3. Document Readiness: only queries chunks belonging to READY and current document versions.
   * 4. Cosine Similarity Threshold: drops chunks with similarity below threshold.
   */
  public async searchAuthorizedChunks(
    params: {
      queryVector: number[];
      organizationId: string;
      authorizedProjectIds: string[];
      threshold: number;
      topK: number;
      userId?: string;
      isOrgOwner?: boolean;
    },
    client?: PoolClient
  ): Promise<RetrievedChunk[]> {
    if (params.authorizedProjectIds.length === 0) {
      // User has access to 0 projects in this scope -> no chunks can be retrieved
      return [];
    }

    // Format vector as string '[v1,v2,...]' for pgvector
    const vectorString = `[${params.queryVector.join(',')}]`;
    const isOwner = params.isOrgOwner === true;
    const userId = params.userId || null;

    const sql = `
      SELECT
        c.id AS chunk_id,
        c.content,
        c.chunk_index,
        c.page_number,
        d.id AS document_id,
        d.name AS document_name,
        p.id AS project_id,
        p.name AS project_name,
        (1 - (c.embedding <=> $1::vector))::float AS similarity
      FROM document_chunks c
      JOIN document_versions dv ON c.document_version_id = dv.id
      JOIN documents d ON dv.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE p.organization_id = $2
        AND dv.status = 'READY'
        AND dv.is_current = true
        AND c.embedding IS NOT NULL
        AND p.id = ANY($3::uuid[])
        AND (1 - (c.embedding <=> $1::vector)) >= $4
        AND (
          d.access_mode = 'PROJECT'
          OR $6::boolean = true
          OR (
            d.access_mode = 'RESTRICTED'
            AND $7::uuid IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM (
                SELECT effect FROM document_user_access WHERE document_id = d.id AND user_id = $7
                UNION ALL
                SELECT dga.effect FROM document_group_access dga
                JOIN group_memberships gm ON dga.group_id = gm.group_id
                WHERE dga.document_id = d.id AND gm.user_id = $7
                UNION ALL
                SELECT dora.effect FROM document_org_role_access dora
                JOIN organization_memberships om ON dora.role = om.role
                WHERE dora.document_id = d.id AND om.user_id = $7 AND om.organization_id = $2
                UNION ALL
                SELECT dpra.effect FROM document_project_role_access dpra
                JOIN project_memberships pm ON dpra.role = pm.role
                WHERE dpra.document_id = d.id AND pm.user_id = $7 AND pm.project_id = d.project_id
              ) r_deny WHERE effect = 'DENY'
            )
            AND EXISTS (
              SELECT 1 FROM (
                SELECT effect FROM document_user_access WHERE document_id = d.id AND user_id = $7
                UNION ALL
                SELECT dga.effect FROM document_group_access dga
                JOIN group_memberships gm ON dga.group_id = gm.group_id
                WHERE dga.document_id = d.id AND gm.user_id = $7
                UNION ALL
                SELECT dora.effect FROM document_org_role_access dora
                JOIN organization_memberships om ON dora.role = om.role
                WHERE dora.document_id = d.id AND om.user_id = $7 AND om.organization_id = $2
                UNION ALL
                SELECT dpra.effect FROM document_project_role_access dpra
                JOIN project_memberships pm ON dpra.role = pm.role
                WHERE dpra.document_id = d.id AND pm.user_id = $7 AND pm.project_id = d.project_id
              ) r_allow WHERE effect = 'ALLOW'
            )
          )
        )
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $5;
    `;

    const queryParams = [
      vectorString,
      params.organizationId,
      params.authorizedProjectIds,
      params.threshold,
      params.topK,
      isOwner,
      userId,
    ];

    // An HNSW index returns only the ~40 globally nearest rows and the tenant/access filters are applied
    // afterwards, which can starve results in a multi-tenant table. Iterative scans keep reading until enough
    // rows pass the filters (pgvector >= 0.8); the setting is skipped gracefully where unsupported.
    const run = async (executor: PoolClient): Promise<RetrievedChunk[]> => {
      await executor.query('BEGIN');
      try {
        await executor.query('SAVEPOINT hnsw_scan');
        try {
          await executor.query("SELECT set_config('hnsw.iterative_scan', 'strict_order', true)");
          await executor.query('RELEASE SAVEPOINT hnsw_scan');
        } catch {
          await executor.query('ROLLBACK TO SAVEPOINT hnsw_scan');
        }
        const result = await executor.query<RetrievedChunk>(sql, queryParams);
        await executor.query('COMMIT');
        return result.rows;
      } catch (err) {
        await executor.query('ROLLBACK').catch(() => undefined);
        throw err;
      }
    };

    if (client) {
      // The caller owns the transaction; just run the query on it.
      return this.query<RetrievedChunk>(sql, queryParams, client);
    }

    const poolClient = await pool.connect();
    try {
      return await run(poolClient);
    } finally {
      poolClient.release();
    }
  }
}

export const ragRepository = new RagRepository();
