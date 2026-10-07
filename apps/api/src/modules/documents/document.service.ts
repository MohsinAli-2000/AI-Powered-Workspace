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
import { auditService, type AuditService } from '../audit/audit.service.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../errors/app-error.js';
import { logger } from '../../utils/logger.js';
import { documentAccessRepository } from './document-access.repository.js';

export class DocumentService {
  constructor(
    private readonly documentRepo: DocumentRepository = documentRepository,
    private readonly documentVersionRepo: DocumentVersionRepository = documentVersionRepository,
    private readonly projectRepo: ProjectRepository = projectRepository,
    private readonly storage: StorageService = storageService,
    private readonly queue: QueueService = queueService,
    private readonly audit: AuditService = auditService
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
    const storageKey = `documents/${documentId}/${sanitizedFilename}`;

    // 4. Upload file to Object Storage (MinIO / S3)
    await this.storage.uploadFile(storageKey, file.buffer, file.mimetype);

    // 5. Atomic Database Transaction (only a failure HERE should remove the uploaded object)
    let result: DocumentWithCurrentVersion;
    try {
      result = await BaseRepository.withTransaction(async (transactionClient) => {
        const displayName = metadata.name?.trim() || file.originalname;
        const accessMode = metadata.access_mode ?? 'PROJECT';

        const createdDoc = await this.documentRepo.create(
          {
            id: documentId,
            organization_id: project.organization_id,
            project_id: projectId,
            name: displayName,
            description: metadata.description,
            access_mode: accessMode,
            created_by: uploaderUserId,
          },
          transactionClient
        );

        // A RESTRICTED document with no rules would be invisible to its own uploader (and non-owner
        // managers), making the upload look lost. Grant the uploader access up front.
        if (accessMode === 'RESTRICTED') {
          await documentAccessRepository.upsertUserAccess(
            createdDoc.id,
            uploaderUserId,
            'ALLOW',
            transactionClient
          );
        }

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
    } catch (dbError) {
      // Clean up the orphaned storage object: the database has no record of it.
      logger.error({ storageKey, dbError }, 'Rolling back storage upload after database failure.');
      await this.storage.deleteFile(storageKey).catch(() => {});
      throw dbError;
    }

    // 6. Publish Background Processing Job (FR-DOC-009). The rows are committed, so a problem past this
    // point must never delete the stored file; the queue's recovery sweep re-dispatches stuck jobs.
    try {
      await this.queue.publishDocumentProcessingJob({
        document_id: result.id,
        version_id: result.current_version_id,
        organization_id: result.organization_id,
        project_id: result.project_id,
        storage_key: storageKey,
        mime_type: file.mimetype,
        original_filename: file.originalname,
      });
    } catch (queueError) {
      logger.error({ versionId: result.current_version_id, queueError }, 'Failed to dispatch processing job');
    }

    await this.audit.record({
      organizationId: project.organization_id,
      actorUserId: uploaderUserId,
      action: 'document.uploaded',
      resourceType: 'document',
      resourceId: result.id,
      metadata: {
        name: result.name,
        projectId,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return result;
  }

  /**
   * Lists all documents within a project.
   * If userFilter is provided, filters out RESTRICTED documents that the user cannot access.
   */
  public async listProjectDocuments(
    projectId: string,
    userFilter?: {
      userId: string;
      organizationId: string;
      isOrgOwner: boolean;
    }
  ): Promise<DocumentWithCurrentVersion[]> {
    return this.documentRepo.listByProject(projectId, undefined, userFilter);
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
   * Re-queues a document whose processing FAILED (transient embedding errors, provider outages...) so the
   * user does not have to delete and re-upload it.
   */
  public async reprocessDocument(documentId: string): Promise<DocumentWithCurrentVersion> {
    const document = await this.getDocument(documentId);
    const version = await this.documentVersionRepo.findCurrentByDocumentId(documentId);
    if (!version) {
      throw new NotFoundError('Document version content not found.');
    }
    if (version.status !== 'FAILED') {
      throw new ConflictError(
        `Only documents whose processing failed can be retried (current status: ${version.status}).`
      );
    }

    // Conditional update so two quick clicks cannot start two runs.
    const requeued = await this.documentVersionRepo.requeueIfFailed(version.id);
    if (!requeued) {
      throw new ConflictError('This document is already being processed again.');
    }

    await this.queue.publishDocumentProcessingJob({
      document_id: document.id,
      version_id: version.id,
      organization_id: document.organization_id,
      project_id: document.project_id,
      storage_key: version.storage_key,
      mime_type: version.mime_type,
      original_filename: version.original_filename,
    });

    await this.audit.record({
      organizationId: document.organization_id,
      action: 'document.reprocessed',
      resourceType: 'document',
      resourceId: documentId,
      metadata: { name: document.name },
    });

    return this.getDocument(documentId);
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
      expiresInSeconds,
      currentVersion.original_filename
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

    if (input.access_mode !== undefined) {
      queryParams.push(input.access_mode);
      setClauses.push(`access_mode = $${queryParams.length}`);
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

    await this.audit.record({
      organizationId: existing.organization_id,
      action: 'document.updated',
      resourceType: 'document',
      resourceId: documentId,
      metadata: { name: input.name, accessMode: input.access_mode },
    });

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

    await this.audit.record({
      organizationId: document.organization_id,
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: documentId,
      metadata: { name: document.name, projectId: document.project_id },
    });

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
