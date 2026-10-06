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
        -- A FAILED version is unusable; it must not block re-uploading the same file.
        AND dv.status <> 'FAILED'
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
   * FAILED -> QUEUED, atomically. Returns false if the version was not FAILED any more.
   */
  public async requeueIfFailed(versionId: string, databaseClient?: PoolClient): Promise<boolean> {
    const { rowCount } = await this.execute(
      `UPDATE ${this.tableName}
          SET status = 'QUEUED', processed_at = NULL, updated_at = NOW()
        WHERE id = $1 AND status = 'FAILED'`,
      [versionId],
      databaseClient
    );
    return rowCount > 0;
  }

  /**
   * Storage keys of every version of every document in a project (used to purge S3 after a project delete).
   */
  public async listStorageKeysByProject(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<string[]> {
    const rows = await this.query<{ storage_key: string }>(
      `SELECT dv.storage_key
         FROM ${this.tableName} dv
         JOIN documents d ON d.id = dv.document_id
        WHERE d.project_id = $1;`,
      [projectId],
      databaseClient
    );
    return rows.map((r) => r.storage_key);
  }

  /**
   * Storage keys of every version of every document in an organization.
   */
  public async listStorageKeysByOrganization(
    organizationId: string,
    databaseClient?: PoolClient
  ): Promise<string[]> {
    const rows = await this.query<{ storage_key: string }>(
      `SELECT dv.storage_key
         FROM ${this.tableName} dv
         JOIN documents d ON d.id = dv.document_id
        WHERE d.organization_id = $1;`,
      [organizationId],
      databaseClient
    );
    return rows.map((r) => r.storage_key);
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
