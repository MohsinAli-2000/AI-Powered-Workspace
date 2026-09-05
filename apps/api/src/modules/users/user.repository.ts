import { BaseRepository } from '../../db/base.repository.js';
import { pool, type PoolClient } from '../../db/pool.js';
import type { User, CreateUserInput } from './user.entity.js';

export class UserRepository extends BaseRepository<User> {
  protected readonly tableName = 'users';

  /**
   * Finds a user by email address (case-insensitive).
   */
  public async findByEmail(
    emailAddress: string,
    databaseClient?: PoolClient
  ): Promise<User | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    return this.queryOne<User>(sqlQuery, [emailAddress], databaseClient);
  }

  /**
   * Creates a new user record.
   */
  public async create(
    newUserData: CreateUserInput,
    databaseClient?: PoolClient
  ): Promise<User> {
    const sqlQuery = `
      INSERT INTO ${this.tableName} (email, password_hash, name)
      VALUES (LOWER($1), $2, $3)
      RETURNING *;
    `;
    const insertedUserRows = await this.query<User>(
      sqlQuery,
      [newUserData.email, newUserData.password_hash, newUserData.name],
      databaseClient
    );
    return insertedUserRows[0];
  }

  /**
   * Marks a user's email address as verified.
   */
  public async markEmailVerified(
    userId: string,
    databaseClient?: PoolClient
  ): Promise<User | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET email_verified_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    return this.queryOne<User>(sqlQuery, [userId], databaseClient);
  }

  /**
   * Updates a user's password hash.
   */
  public async updatePassword(
    userId: string,
    newPasswordHash: string,
    databaseClient?: PoolClient
  ): Promise<boolean> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1;
    `;
    const queryExecutor = databaseClient ?? pool;
    const updateResult = await queryExecutor.query(sqlQuery, [userId, newPasswordHash]);
    return (updateResult.rowCount ?? 0) > 0;
  }
}

// Export singleton instance for application-wide use
export const userRepository = new UserRepository();
