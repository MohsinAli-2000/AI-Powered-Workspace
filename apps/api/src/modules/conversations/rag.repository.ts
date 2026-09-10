import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
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
    },
    client?: PoolClient
  ): Promise<RetrievedChunk[]> {
    if (params.authorizedProjectIds.length === 0) {
      // User has access to 0 projects in this scope -> no chunks can be retrieved
      return [];
    }

    // Format vector as string '[v1,v2,...]' for pgvector
    const vectorString = `[${params.queryVector.join(',')}]`;

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
      ORDER BY c.embedding <=> $1::vector ASC
      LIMIT $5;
    `;

    return this.query<RetrievedChunk>(
      sql,
      [
        vectorString,
        params.organizationId,
        params.authorizedProjectIds,
        params.threshold,
        params.topK,
      ],
      client
    );
  }
}

export const ragRepository = new RagRepository();
