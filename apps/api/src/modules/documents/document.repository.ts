import { BaseRepository } from '../../db/base.repository.js';
import type { PoolClient } from '../../db/pool.js';
import type {
  Document,
  DocumentAccessMode,
  DocumentWithCurrentVersion,
} from './document.entity.js';

export class DocumentRepository extends BaseRepository<Document> {
  protected readonly tableName = 'documents';

  /**
   * Creates a new document record.
   */
  public async create(
    documentData: {
      id?: string;
      organization_id: string;
      project_id: string;
      name: string;
      description?: string | null;
      access_mode?: DocumentAccessMode;
      created_by?: string | null;
    },
    databaseClient?: PoolClient
  ): Promise<Document> {
    if (documentData.id) {
      const sqlQuery = `
        INSERT INTO ${this.tableName}
          (id, organization_id, project_id, name, description, access_mode, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const createdRows = await this.query<Document>(
        sqlQuery,
        [
          documentData.id,
          documentData.organization_id,
          documentData.project_id,
          documentData.name.trim(),
          documentData.description ? documentData.description.trim() : null,
          documentData.access_mode ?? 'PROJECT',
          documentData.created_by ?? null,
        ],
        databaseClient
      );
      return createdRows[0];
    }

    const sqlQuery = `
      INSERT INTO ${this.tableName}
        (organization_id, project_id, name, description, access_mode, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const createdRows = await this.query<Document>(
      sqlQuery,
      [
        documentData.organization_id,
        documentData.project_id,
        documentData.name.trim(),
        documentData.description ? documentData.description.trim() : null,
        documentData.access_mode ?? 'PROJECT',
        documentData.created_by ?? null,
      ],
      databaseClient
    );
    return createdRows[0];
  }

  /**
   * Finds a document by ID and project ID for scoped access.
   */
  public async findByIdAndProject(
    documentId: string,
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<Document | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 AND project_id = $2
      LIMIT 1;
    `;
    return this.queryOne<Document>(sqlQuery, [documentId, projectId], databaseClient);
  }

  /**
   * Retrieves all documents belonging to a project, enriched with current version details.
   */
  public async listByProject(
    projectId: string,
    databaseClient?: PoolClient
  ): Promise<DocumentWithCurrentVersion[]> {
    const sqlQuery = `
      SELECT
        d.*,
        dv.id AS current_version_id,
        dv.version_number,
        dv.status,
        dv.mime_type,
        dv.file_size::bigint AS file_size,
        dv.original_filename,
        u.name AS creator_name
      FROM ${this.tableName} d
      INNER JOIN document_versions dv
        ON dv.document_id = d.id AND dv.is_current = true
      LEFT JOIN users u
        ON u.id = d.created_by
      WHERE d.project_id = $1
      ORDER BY d.created_at DESC;
    `;
    return this.query<DocumentWithCurrentVersion>(sqlQuery, [projectId], databaseClient);
  }

  /**
   * Retrieves a single document by ID joined with its current version details.
   */
  public async getWithCurrentVersionById(
    documentId: string,
    databaseClient?: PoolClient
  ): Promise<DocumentWithCurrentVersion | null> {
    const sqlQuery = `
      SELECT
        d.*,
        dv.id AS current_version_id,
        dv.version_number,
        dv.status,
        dv.mime_type,
        dv.file_size::bigint AS file_size,
        dv.original_filename,
        u.name AS creator_name
      FROM ${this.tableName} d
      INNER JOIN document_versions dv
        ON dv.document_id = d.id AND dv.is_current = true
      LEFT JOIN users u
        ON u.id = d.created_by
      WHERE d.id = $1
      LIMIT 1;
    `;
    return this.queryOne<DocumentWithCurrentVersion>(sqlQuery, [documentId], databaseClient);
  }

  /**
   * Deletes a document by ID.
   * Cascade delete on foreign keys will remove associated document_versions and chunks.
   */
  public async delete(
    documentId: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    return this.deleteById(documentId, databaseClient);
  }
}

export const documentRepository = new DocumentRepository();
