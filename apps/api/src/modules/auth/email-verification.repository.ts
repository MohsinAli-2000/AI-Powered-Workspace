import { BaseRepository } from '../../db/base.repository.js';
import { type PoolClient } from '../../db/pool.js';

export type EmailVerificationStatus = 'PENDING' | 'VERIFIED' | 'CONSUMED';

export interface EmailVerification {
  id: string;
  email: string;
  token_hash: string;
  status: EmailVerificationStatus;
  expires_at: Date;
  created_at: Date;
  verified_at: Date | null;
  consumed_at: Date | null;
}

export interface CreateEmailVerificationInput {
  email: string;
  token_hash: string;
  expires_at: Date;
}

export class EmailVerificationRepository extends BaseRepository<EmailVerification> {
  protected readonly tableName = 'email_verifications';

  /**
   * Creates a new pending email verification record.
   */
  public async create(
    input: CreateEmailVerificationInput,
    databaseClient?: PoolClient
  ): Promise<EmailVerification> {
    const sqlQuery = `
      INSERT INTO ${this.tableName} (email, token_hash, expires_at, status)
      VALUES (LOWER($1), $2, $3, 'PENDING')
      RETURNING *;
    `;
    const insertedRows = await this.query<EmailVerification>(
      sqlQuery,
      [input.email, input.token_hash, input.expires_at],
      databaseClient
    );
    return insertedRows[0];
  }

  /**
   * Finds an email verification record by SHA-256 token hash.
   */
  public async findByTokenHash(
    tokenHash: string,
    databaseClient?: PoolClient
  ): Promise<EmailVerification | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE token_hash = $1
      LIMIT 1;
    `;
    return this.queryOne<EmailVerification>(sqlQuery, [tokenHash], databaseClient);
  }

  /**
   * Marks a pending email verification as verified (email ownership proven).
   */
  public async markVerified(
    id: string,
    databaseClient?: PoolClient
  ): Promise<EmailVerification | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET status = 'VERIFIED', verified_at = NOW()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING *;
    `;
    return this.queryOne<EmailVerification>(sqlQuery, [id], databaseClient);
  }

  /**
   * Atomically transitions a pending or verified token to CONSUMED when creating an account.
   * Returns null if already consumed or invalid, preventing race conditions and replay attacks.
   */
  public async transitionToConsumed(
    id: string,
    databaseClient?: PoolClient
  ): Promise<EmailVerification | null> {
    const sqlQuery = `
      UPDATE ${this.tableName}
      SET status = 'CONSUMED', consumed_at = NOW()
      WHERE id = $1 AND status IN ('PENDING', 'VERIFIED')
      RETURNING *;
    `;
    return this.queryOne<EmailVerification>(sqlQuery, [id], databaseClient);
  }

  /**
   * Finds the latest active pending verification for an email address.
   */
  public async findActiveByEmail(
    email: string,
    databaseClient?: PoolClient
  ): Promise<EmailVerification | null> {
    const sqlQuery = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(email) = LOWER($1)
        AND status IN ('PENDING', 'VERIFIED')
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    return this.queryOne<EmailVerification>(sqlQuery, [email], databaseClient);
  }
}

export const emailVerificationRepository = new EmailVerificationRepository();
