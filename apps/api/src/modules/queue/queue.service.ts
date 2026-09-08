import { logger } from '../../utils/logger.js';

export interface ProcessDocumentJobPayload {
  document_id: string;
  version_id: string;
  organization_id: string;
  project_id: string;
  storage_key: string;
  mime_type: string;
  original_filename: string;
}

export class QueueService {
  /**
   * Publishes a PROCESS_DOCUMENT job to the message broker.
   * In Phase 9, this formats and logs the queue job; Phase 10 will connect the active RabbitMQ consumer.
   */
  public async publishDocumentProcessingJob(
    payload: ProcessDocumentJobPayload
  ): Promise<void> {
    const job = {
      job_type: 'PROCESS_DOCUMENT',
      ...payload,
      created_at: new Date().toISOString(),
    };

    logger.info(
      {
        jobType: job.job_type,
        documentId: job.document_id,
        versionId: job.version_id,
        storageKey: job.storage_key,
      },
      '📢 [QUEUE] Dispatched PROCESS_DOCUMENT job'
    );
  }
}

export const queueService = new QueueService();
