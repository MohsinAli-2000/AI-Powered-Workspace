import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
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
   * Publishes a PROCESS_DOCUMENT job to the message broker / background worker.
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

    // Asynchronously spawn Python worker to process the version immediately
    this.triggerPythonProcessor(payload.version_id);
  }

  private triggerPythonProcessor(versionId: string): void {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      // apps/api/src/modules/queue -> apps/worker
      const workerDir = path.resolve(currentDir, '../../../../worker');
      const pythonBin = path.join(workerDir, '.venv/bin/python');

      const child = spawn(
        pythonBin,
        ['-m', 'src.process_job', versionId],
        {
          cwd: workerDir,
          env: {
            ...process.env,
            PYTHONPATH: '.',
          },
          detached: true,
          stdio: 'ignore',
        }
      );

      child.unref();
      logger.info({ versionId }, '🚀 Spawned background Python document processor');
    } catch (err) {
      logger.error({ versionId, err }, 'Failed to trigger background Python processor');
    }
  }
}

export const queueService = new QueueService();
