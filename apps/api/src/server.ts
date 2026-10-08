import { initSentry } from './config/sentry.js';
import { env } from './config/env.js';
import app from './app.js';
import { logger } from './utils/logger.js';
import { closePool } from './db/pool.js';
import { queueService } from './modules/queue/queue.service.js';

// Initialize Sentry monitoring before loading the application
initSentry();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API Server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
});

// Behind the reverse proxy (Caddy) connections are reused. Node's default 5s keep-alive timeout closes idle
// connections sooner than the proxy expects, so a reused connection can be reset mid-request. Keep them open
// longer than the proxy's idle timeout, with headersTimeout above keepAliveTimeout as Node requires.
server.keepAliveTimeout = 125_000;
server.headersTimeout = 130_000;

// Repair document versions stuck in QUEUED/PROCESSING (API restarts, crashed workers).
queueService.startRecovery();

// Last-resort safety nets: log instead of dying silently, and release the DB pool on shutdown.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
});

const shutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down...`);
  server.close(() => {
    closePool()
      .catch((err) => logger.error({ err }, 'Error while closing the database pool'))
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
