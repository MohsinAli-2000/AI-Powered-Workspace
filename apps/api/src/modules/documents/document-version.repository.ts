import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  DocumentVersion,
  DocumentVersionStatus,
} from './document.entity.js';

export class DocumentVersionRepository extends BaseRepository<DocumentVersion> {
  protected readonly tableName = 'document_versions';

  /**
   * Creates a new document version record.
   */
  public async create(
    versionData: {
      document_id: string;
      version_number: number;
      storage_key: string;
      original_filename: string;
      mime_type: string;
      file_size: number;
      content_hash: string;
      status?: DocumentVersionStatus;
      is_current?: boolean;
      created_by?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<DocumentVersion> {
    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (
          document_id,
          version_number,
          storage_key,
          original_filename,
          mime_type,
          file_size,
          content_hash,
          status,
          is_current,
          created_by
        )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const createdRows = await this.query<DocumentVersion>(
      sqlQuery,
      [
        versionData.document_id,
        versionData.version_number,
        versionData.storage_key,
        versionData.original_filename,
        versionData.mime_type,
        versionData.file_size,
        versionData.content_hash,
        versionData.status ?? 'QUEUED',
        versionData.is_current ?? true,
        versionData.created_by ?? null,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds the current active version for a document.
   */
  public async findCurrentByDocumentId(
    documentId: string,
    databaseClient?: PoolClient
  ): Promise<DocumentVersion | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE document_id = $1 AND is_current = true
      LIMIT 1;
    `;
    return this.queryOne<DocumentVersion>(sqlQuery, [documentId], databaseClient);
  }

  /**
   * Checks if an active document version with the same content hash already exists
   * in the specified project. Used to enforce FR-DOC-005 (Duplicate Document Prevention).
   */
  public async findByContentHashAndProject(
    contentHash: string,
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<DocumentVersion | null> {
    const sqlQuery = `
      SELECT dv.*
      FROM ${this.tableName} dv
      INNER JOIN documents d ON d.id = dv.document_id
      WHERE dv.content_hash = $1
        AND d.project_id = $2
        AND dv.is_current = true
      LIMIT 1;
    `;
    return this.queryOne<DocumentVersion>(
      sqlQuery,
      [contentHash, projectId],
      databaseClient
    );
  }

  /**
   * Updates the processing status of a document version.
   */
  public async updateStatus(
    versionId: string,
    status: DocumentVersionStatus,
    databaseClient?: PoolClient
  ): Promise<DocumentVersion | null> {
    const isCompleted = status === 'READY' || status === 'FAILED';
    const processedAtClause = isCompleted ? ', processed_at = NOW()' : '';

    const sqlQuery = `
      UPDATE ${this.tableName}
      SET status = $1, updated_at = NOW() ${processedAtClause}
      WHERE id = $2
      RETURNING *;
    `;
    const updatedRows = await this.query<DocumentVersion>(
      sqlQuery,
      [status, versionId],
      databaseClient
    );
    return updatedRows[0] ?? null;
  }

  /**
   * Lists all versions for a document.
   */
  public async listByDocumentId(
    documentId: string,
    databaseClient?: PoolClient
  ): Promise<DocumentVersion[]> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE document_id = $1
      ORDER BY version_number DESC;
    `;
    return this.query<DocumentVersion>(sqlQuery, [documentId], databaseClient);
  }
}

export const documentVersionRepository = new DocumentVersionRepository();
