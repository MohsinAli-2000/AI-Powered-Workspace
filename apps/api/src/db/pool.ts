import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DB_POOL_MIN,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Pool lifecycle event handlers
pool.on('connect', () => {
  logger.debug('New client connected to PostgreSQL pool');
});

pool.on('error', (err: Error) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Health check helper to test database connectivity and measure latency.
 */
export const checkDbHealth = async (): Promise<{
  isHealthy: boolean;
  latencyMs: number;
  error?: string;
}> => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return {
      isHealthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ err }, 'PostgreSQL health check ping failed');
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
};

/**
 * Graceful shutdown helper to close all active pool connections.
 */
export const closePool = async (): Promise<void> => {
  logger.info('Closing PostgreSQL pool connections...');
  await pool.end();
  logger.info('PostgreSQL pool closed successfully');
};

export type { PoolClient, QueryResult, QueryResultRow };
