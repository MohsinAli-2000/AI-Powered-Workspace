import { pool, type PoolClient, type QueryResultRow } from './pool.js';
import { logger } from '../utils/logger.js';

export abstract class BaseRepository<TEntity extends QueryResultRow> {
  protected abstract readonly tableName: string;

  /**
   * Executes a parameterized query against the connection pool, or reuses an existing transaction client.
   */
  public async query<TRow extends QueryResultRow = TEntity>(
    sqlQuery: string,
    queryParameters: unknown[] = [],
    databaseClient?: PoolClient
  ): Promise<TRow[]> {
    // If a databaseClient (such as a transactionClient) is provided, use it; otherwise, use the global connection pool.
    const queryExecutor = databaseClient ?? pool;
    const startTimeMs = Date.now();

    try {
      const queryResult = await queryExecutor.query<TRow>(sqlQuery, queryParameters);
      const executionDurationMs = Date.now() - startTimeMs;

      logger.trace(
        {
          sqlQuery,
          queryParameters,
          executionDurationMs,
          affectedRowCount: queryResult.rowCount,
        },
        'Executed database query'
      );

      return queryResult.rows;
    } catch (databaseError) {
      logger.error(
        { sqlQuery, queryParameters, databaseError },
        'Database query execution failed'
      );
      throw databaseError;
    }
  }

  /**
   * Executes a query expecting zero or one row.
   */
  public async queryOne<TRow extends QueryResultRow = TEntity>(
    sqlQuery: string,
    queryParameters: unknown[] = [],
    databaseClient?: PoolClient
  ): Promise<TRow | null> {
    const matchingRows = await this.query<TRow>(sqlQuery, queryParameters, databaseClient);
    return matchingRows[0] ?? null;
  }

  /**
   * Finds a single record by its UUID primary key.
   */
  public async findById(recordId: string, databaseClient?: PoolClient): Promise<TEntity | null> {
    const sqlQuery = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1;`;
    return this.queryOne<TEntity>(sqlQuery, [recordId], databaseClient);
  }

  /**
   * Executes a parameterized query (such as DELETE or UPDATE) and returns rowCount.
   */
  public async execute(
    sqlQuery: string,
    queryParameters: unknown[] = [],
    databaseClient?: PoolClient
  ): Promise<{ rowCount: number }> {
    const queryExecutor = databaseClient ?? pool;
    const result = await queryExecutor.query(sqlQuery, queryParameters);
    return { rowCount: result.rowCount ?? 0 };
  }

  /**
   * Deletes a single record by its UUID primary key.
   */
  public async deleteById(recordId: string, databaseClient?: PoolClient): Promise<boolean> {
    const sqlQuery = `DELETE FROM ${this.tableName} WHERE id = $1;`;
    const queryExecutor = databaseClient ?? pool;
    const deleteResult = await queryExecutor.query(sqlQuery, [recordId]);
    return (deleteResult.rowCount ?? 0) > 0;
  }

  /**
   * Counts records in the table, optionally matching simple filter criteria.
   */
  public async count(
    filterCriteria: Record<string, unknown> = {},
    databaseClient?: PoolClient
  ): Promise<number> {
    const filterFieldNames = Object.keys(filterCriteria);
    let sqlQuery = `SELECT COUNT(*)::int AS total_count FROM ${this.tableName}`;
    const queryParameters: unknown[] = [];

    if (filterFieldNames.length > 0) {
      const whereClauses = filterFieldNames.map(
        (fieldName, parameterIndex) => `${fieldName} = $${parameterIndex + 1}`
      );
      sqlQuery += ` WHERE ${whereClauses.join(' AND ')}`;
      queryParameters.push(...Object.values(filterCriteria));
    }

    const countRow = await this.queryOne<{ total_count: number }>(
      sqlQuery,
      queryParameters,
      databaseClient
    );
    return countRow?.total_count ?? 0;
  }

  /**
   * Runs multiple database operations inside a single atomic transaction.
   * Explicit flow:
   *   pool.connect() -> transactionClient -> transactionCallback(transactionClient) -> COMMIT / ROLLBACK
   */
  public static async withTransaction<TResult>(
    transactionCallback: (transactionClient: PoolClient) => Promise<TResult>
  ): Promise<TResult> {
    const transactionClient = await pool.connect();
    // Set when the connection itself is unusable, so the pool discards it instead of reusing it.
    let discardClient: Error | undefined;

    try {
      await transactionClient.query('BEGIN');
      const transactionResult = await transactionCallback(transactionClient);
      const commitResult = await transactionClient.query('COMMIT');
      // If any statement inside the transaction failed (even if the error was caught), Postgres answers
      // COMMIT with the tag ROLLBACK instead of throwing. Treat that as a failure - never report success
      // for data that was not saved.
      if (commitResult.command === 'ROLLBACK') {
        throw new Error('Transaction was rolled back by the database; no changes were saved.');
      }
      return transactionResult;
    } catch (transactionError) {
      try {
        await transactionClient.query('ROLLBACK');
      } catch (rollbackError) {
        // The connection is broken: keep the original error and make sure this client is thrown away.
        discardClient = rollbackError as Error;
        logger.error({ rollbackError }, 'ROLLBACK failed; discarding database connection');
      }
      logger.error({ transactionError }, 'Transaction rolled back due to error');
      throw transactionError;
    } finally {
      transactionClient.release(discardClient);
    }
  }
}
