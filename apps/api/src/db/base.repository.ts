import { pool, type PoolClient, type QueryResultRow } from './pool.js';
import { logger } from '../utils/logger.js';

export abstract class BaseRepository<T extends QueryResultRow> {
  protected abstract readonly tableName: string;

  /**
   * Executes a parameterized query against the pool or an existing transaction client.
   */
  public async query<R extends QueryResultRow = T>(
    sql: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<R[]> {
    const executor = client ?? pool;
    const start = Date.now();

    try {
      const result = await executor.query<R>(sql, params);
      const duration = Date.now() - start;

      logger.trace(
        { sql, params, duration, rowCount: result.rowCount },
        'Executed database query'
      );

      return result.rows;
    } catch (error) {
      logger.error({ sql, params, error }, 'Database query execution failed');
      throw error;
    }
  }

  /**
   * Executes a query expecting zero or one row.
   */
  public async queryOne<R extends QueryResultRow = T>(
    sql: string,
    params: unknown[] = [],
    client?: PoolClient
  ): Promise<R | null> {
    const rows = await this.query<R>(sql, params, client);
    return rows[0] ?? null;
  }

  /**
   * Finds a single record by its UUID primary key.
   */
  public async findById(id: string, client?: PoolClient): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1;`;
    return this.queryOne<T>(sql, [id], client);
  }

  /**
   * Deletes a single record by its UUID primary key.
   * Returns true if a record was deleted, false otherwise.
   */
  public async deleteById(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = $1;`;
    const executor = client ?? pool;
    const result = await executor.query(sql, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Counts records in the table, optionally matching simple filter criteria.
   */
  public async count(
    criteria: Record<string, unknown> = {},
    client?: PoolClient
  ): Promise<number> {
    const keys = Object.keys(criteria);
    let sql = `SELECT COUNT(*)::int AS total FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (keys.length > 0) {
      const clauses = keys.map((key, idx) => `${key} = $${idx + 1}`);
      sql += ` WHERE ${clauses.join(' AND ')}`;
      params.push(...Object.values(criteria));
    }

    const row = await this.queryOne<{ total: number }>(sql, params, client);
    return row?.total ?? 0;
  }

  /**
   * Runs multiple database operations inside a single atomic transaction.
   * Automatically executes BEGIN, COMMIT, ROLLBACK, and releases the client.
   */
  public static async withTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Transaction rolled back due to error');
      throw error;
    } finally {
      client.release();
    }
  }
}
