import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../db/pool.js';
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

/** Each job loads the embedding stack and opens DB connections, so only a few may run at once. */
const MAX_CONCURRENT_JOBS = 2;
/** A version still PROCESSING after this long means its worker died; mark it FAILED so the UI stops waiting. */
const STUCK_PROCESSING_MINUTES = 20;
/** A version still QUEUED after this long was never picked up (API restarted, spawn failed...); run it again. */
const STUCK_QUEUED_MINUTES = 2;
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

export class QueueService {
  private readonly pending: string[] = [];
  private readonly tracked = new Set<string>(); // versions that are queued or currently running
  private running = 0;
  private recoveryTimer: NodeJS.Timeout | null = null;

  /**
   * Publishes a PROCESS_DOCUMENT job to the background worker.
   */
  public async publishDocumentProcessingJob(
    payload: ProcessDocumentJobPayload
  ): Promise<void> {
    logger.info(
      {
        jobType: 'PROCESS_DOCUMENT',
        documentId: payload.document_id,
        versionId: payload.version_id,
        storageKey: payload.storage_key,
      },
      '📢 [QUEUE] Dispatched PROCESS_DOCUMENT job'
    );

    this.enqueue(payload.version_id);
  }

  /**
   * Starts the periodic sweep that repairs versions stuck in QUEUED / PROCESSING.
   * Safe to call once at server start.
   */
  public startRecovery(): void {
    if (this.recoveryTimer) return;
    setTimeout(() => void this.recoverStuckVersions(), 5_000).unref();
    this.recoveryTimer = setInterval(() => void this.recoverStuckVersions(), RECOVERY_INTERVAL_MS);
    this.recoveryTimer.unref();
  }

  private enqueue(versionId: string): void {
    if (this.tracked.has(versionId)) return;
    this.tracked.add(versionId);
    this.pending.push(versionId);
    this.drain();
  }

  private drain(): void {
    while (this.running < MAX_CONCURRENT_JOBS && this.pending.length > 0) {
      const versionId = this.pending.shift() as string;
      this.running += 1;
      this.runWorker(versionId, () => {
        this.running -= 1;
        this.tracked.delete(versionId);
        this.drain();
      });
    }
  }

  private runWorker(versionId: string, onDone: () => void): void {
    let finished = false;
    const finish = (reason: string | null): void => {
      if (finished) return;
      finished = true;
      if (reason) {
        // The worker marks its own handled failures; this covers crashes before it could (import errors,
        // missing interpreter, killed process) so the document never stays QUEUED forever.
        void this.markFailedIfUnfinished(versionId, reason);
      }
      onDone();
    };

    let logFd: number | null = null;
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      // apps/api/src/modules/queue -> apps/worker
      const workerDir = path.resolve(currentDir, '../../../../worker');
      // Virtualenv layout differs per OS: Scripts/python.exe on Windows, bin/python elsewhere.
      const pythonBin =
        process.platform === 'win32'
          ? path.join(workerDir, '.venv', 'Scripts', 'python.exe')
          : path.join(workerDir, '.venv', 'bin', 'python');

      if (!fs.existsSync(pythonBin)) {
        throw new Error(`Worker Python interpreter not found at ${pythonBin}. Create apps/worker/.venv first.`);
      }

      // Keep the worker's output instead of discarding it: this is the only place its errors are visible.
      const logDir = path.join(workerDir, 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      logFd = fs.openSync(path.join(logDir, 'process_job.log'), 'a');

      const child = spawn(pythonBin, ['-m', 'src.process_job', versionId], {
        cwd: workerDir,
        env: {
          ...process.env,
          PYTHONPATH: '.',
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
        stdio: ['ignore', logFd, logFd],
        windowsHide: true,
      });

      // The child inherited its own copy of the descriptor; the parent's copy can be closed now.
      fs.closeSync(logFd);
      logFd = null;

      child.on('error', (err) => {
        logger.error({ versionId, err }, 'Python document processor failed to start');
        finish(`Document processor could not be started: ${err.message}`);
      });

      child.on('exit', (code, signal) => {
        if (code === 0) {
          logger.info({ versionId }, 'Python document processor finished');
          finish(null);
        } else {
          logger.error({ versionId, code, signal }, 'Python document processor exited abnormally (see apps/worker/logs/process_job.log)');
          finish(`Document processor exited with ${signal ?? `code ${code}`}`);
        }
      });

      logger.info({ versionId, pid: child.pid }, '🚀 Spawned background Python document processor');
    } catch (err) {
      if (logFd !== null) {
        try {
          fs.closeSync(logFd);
        } catch {
          // ignore
        }
      }
      logger.error({ versionId, err }, 'Failed to trigger background Python processor');
      finish(err instanceof Error ? err.message : 'Failed to start the document processor');
    }
  }

  private async markFailedIfUnfinished(versionId: string, reason: string): Promise<void> {
    try {
      const result = await pool.query(
        `UPDATE document_versions
            SET status = 'FAILED', updated_at = NOW()
          WHERE id = $1 AND status IN ('QUEUED', 'PROCESSING')`,
        [versionId]
      );
      if ((result.rowCount ?? 0) > 0) {
        logger.warn({ versionId, reason }, 'Marked document version FAILED after processor problem');
      }
    } catch (err) {
      logger.error({ versionId, err }, 'Could not mark document version as FAILED');
    }
  }

  /**
   * Repairs versions whose worker died or never started.
   */
  public async recoverStuckVersions(): Promise<void> {
    try {
      const failed = await pool.query<{ id: string }>(
        `UPDATE document_versions
            SET status = 'FAILED', updated_at = NOW()
          WHERE status = 'PROCESSING'
            AND updated_at < NOW() - make_interval(mins => $1)
          RETURNING id`,
        [STUCK_PROCESSING_MINUTES]
      );
      if (failed.rows.length > 0) {
        logger.warn({ versionIds: failed.rows.map((r) => r.id) }, 'Marked stuck PROCESSING versions as FAILED');
      }

      const queued = await pool.query<{ id: string }>(
        `SELECT id
           FROM document_versions
          WHERE status = 'QUEUED'
            AND updated_at < NOW() - make_interval(mins => $1)
          ORDER BY created_at ASC
          LIMIT 20`,
        [STUCK_QUEUED_MINUTES]
      );
      for (const row of queued.rows) {
        logger.warn({ versionId: row.id }, 'Re-dispatching document version stuck in QUEUED');
        this.enqueue(row.id);
      }
    } catch (err) {
      logger.error({ err }, 'Document recovery sweep failed');
    }
  }
}

export const queueService = new QueueService();
