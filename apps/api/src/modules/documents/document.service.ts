import crypto from 'crypto';
import path from 'path';
import type { Readable } from 'stream';
import { BaseRepository } from '../../db/base.repository.js';
import {
  documentRepository,
  type DocumentRepository,
} from './document.repository.js';
import {
  documentVersionRepository,
  type DocumentVersionRepository,
} from './document-version.repository.js';
import {
  projectRepository,
  type ProjectRepository,
} from '../projects/project.repository.js';
import {
  storageService,
  type StorageService,
} from '../storage/storage.service.js';
import {
  queueService,
  type QueueService,
} from '../queue/queue.service.js';
import type {
  Document,
  DocumentWithCurrentVersion,
} from './document.entity.js';
import type {
  UploadDocumentInput,
  UpdateDocumentInput,
} from './document.schema.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../errors/app-error.js';
import { logger } from '../../utils/logger.js';

export class DocumentService {
  constructor(
    private readonly documentRepo: DocumentRepository = documentRepository,
    private readonly documentVersionRepo: DocumentVersionRepository = documentVersionRepository,
    private readonly projectRepo: ProjectRepository = projectRepository,
    private readonly storage: StorageService = storageService,
    private readonly queue: QueueService = queueService
  ) {}

  /**
   * Uploads a document to a project:
   * 1. Validates project existence.
   * 2. Computes SHA-256 content hash and detects duplicate uploads within the project.
   * 3. Uploads file to MinIO / S3 object storage.
   * 4. Atomically creates document and document_version records.
   * 5. Dispatches PROCESS_DOCUMENT job to the queue.
   */
  public async uploadDocument(
    projectId: string,
    uploaderUserId: string,
    file: Express.Multer.File,
    metadata: UploadDocumentInput
  ): Promise<DocumentWithCurrentVersion> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    // 1. Calculate SHA-256 content hash
    const contentHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // 2. Duplicate Detection within Project (FR-DOC-005)
    const existingDuplicate =
      await this.documentVersionRepo.findByContentHashAndProject(
        contentHash,
        projectId
      );

    if (existingDuplicate) {
      throw new ConflictError(
        'A document with identical content has already been uploaded to this project.'
      );
    }

    // 3. Generate Unique Document ID and Storage Key
    const documentId = crypto.randomUUID();
    const sanitizedFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `orgs/${project.organization_id}/projects/${projectId}/documents/${documentId}/v1_${sanitizedFilename}`;

    // 4. Upload file to Object Storage (MinIO / S3)
    await this.storage.uploadFile(storageKey, file.buffer, file.mimetype);

    try {
      // 5. Atomic Database Transaction
      const result = await BaseRepository.withTransaction(async (transactionClient) => {
        const displayName = metadata.name?.trim() || file.originalname;

        const createdDoc = await this.documentRepo.create(
          {
            id: documentId,
            organization_id: project.organization_id,
            project_id: projectId,
            name: displayName,
            description: metadata.description,
            access_mode: metadata.access_mode ?? 'PROJECT',
            created_by: uploaderUserId,
          },
          transactionClient
        );

        const createdVersion = await this.documentVersionRepo.create(
          {
            document_id: createdDoc.id,
            version_number: 1,
            storage_key: storageKey,
            original_filename: file.originalname,
            mime_type: file.mimetype,
            file_size: file.size,
            content_hash: contentHash,
            status: 'QUEUED',
            is_current: true,
            created_by: uploaderUserId,
          },
          transactionClient
        );

        return {
          ...createdDoc,
          current_version_id: createdVersion.id,
          version_number: createdVersion.version_number,
          status: createdVersion.status,
          mime_type: createdVersion.mime_type,
          file_size: createdVersion.file_size,
          original_filename: createdVersion.original_filename,
        };
      });

      // 6. Publish Background Processing Job (FR-DOC-009)
      await this.queue.publishDocumentProcessingJob({
        document_id: result.id,
        version_id: result.current_version_id,
        organization_id: result.organization_id,
        project_id: result.project_id,
        storage_key: storageKey,
        mime_type: file.mimetype,
        original_filename: file.originalname,
      });

      return result;
    } catch (dbError) {
      // Clean up orphaned storage object if database transaction failed
      logger.error({ storageKey, dbError }, 'Rolling back storage upload after database failure.');
      await this.storage.deleteFile(storageKey).catch(() => {});
      throw dbError;
    }
  }

  /**
   * Lists all documents within a project.
   */
  public async listProjectDocuments(
    projectId: string
  ): Promise<DocumentWithCurrentVersion[]> {
    return this.documentRepo.listByProject(projectId);
  }

  /**
   * Retrieves single document details joined with current version info.
   */
  public async getDocument(
    documentId: string
  ): Promise<DocumentWithCurrentVersion> {
    const document = await this.documentRepo.getWithCurrentVersionById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found.');
    }
    return document;
  }

  /**
   * Retrieves a readable download stream for the document's original file.
   */
  public async downloadDocument(documentId: string): Promise<{
    stream: Readable;
    contentType: string;
    originalFilename: string;
    fileSize: number;
  }> {
    const document = await this.getDocument(documentId);
    const currentVersion = await this.documentVersionRepo.findCurrentByDocumentId(documentId);

    if (!currentVersion) {
      throw new NotFoundError('Document version content not found.');
    }

    const { stream, contentType } = await this.storage.downloadStream(
      currentVersion.storage_key
    );

    return {
      stream,
      contentType: contentType || currentVersion.mime_type,
      originalFilename: currentVersion.original_filename,
      fileSize: Number(currentVersion.file_size),
    };
  }

  /**
   * Generates a presigned URL for downloading a document directly from storage.
   */
  public async getPresignedDownloadUrl(
    documentId: string,
    expiresInSeconds = 3600
  ): Promise<{ downloadUrl: string; originalFilename: string }> {
    const document = await this.getDocument(documentId);
    const currentVersion = await this.documentVersionRepo.findCurrentByDocumentId(documentId);

    if (!currentVersion) {
      throw new NotFoundError('Document version content not found.');
    }

    const downloadUrl = await this.storage.getPresignedDownloadUrl(
      currentVersion.storage_key,
      expiresInSeconds
    );

    return {
      downloadUrl,
      originalFilename: currentVersion.original_filename,
    };
  }

  /**
   * Updates document metadata (name and/or description).
   */
  public async updateDocument(
    documentId: string,
    input: UpdateDocumentInput
  ): Promise<DocumentWithCurrentVersion> {
    const existing = await this.getDocument(documentId);

    const setClauses: string[] = ['updated_at = NOW()'];
    const queryParams: unknown[] = [documentId];

    if (input.name !== undefined) {
      queryParams.push(input.name.trim());
      setClauses.push(`name = $${queryParams.length}`);
    }

    if (input.description !== undefined) {
      queryParams.push(input.description ? input.description.trim() : null);
      setClauses.push(`description = $${queryParams.length}`);
    }

    const sqlQuery = `
      UPDATE documents
      SET ${setClauses.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    const updatedRows = await this.documentRepo.query<Document>(sqlQuery, queryParams);
    if (!updatedRows[0]) {
      throw new NotFoundError('Document not found.');
    }

    return this.getDocument(documentId);
  }

  /**
   * Deletes a document, cascading its versions in the database,
   * and purging all stored file objects from MinIO / S3.
   */
  public async deleteDocument(documentId: string): Promise<void> {
    const document = await this.documentRepo.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found.');
    }

    // Retrieve all historical versions to purge object storage
    const versions = await this.documentVersionRepo.listByDocumentId(documentId);

    // Delete database record (foreign key ON DELETE CASCADE removes versions & chunks)
    await this.documentRepo.delete(documentId);

    // Clean up objects in storage
    await Promise.all(
      versions.map((version) =>
        this.storage.deleteFile(version.storage_key).catch((err) => {
          logger.warn({ storageKey: version.storage_key, err }, 'Failed to delete storage object during document deletion.');
        })
      )
    );
  }
}

export const documentService = new DocumentService();
