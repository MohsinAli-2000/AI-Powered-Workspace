import { createHash, randomBytes } from 'node:crypto';

/**
 * Produces a SHA-256 hex digest of the supplied raw token string.
 * Used to store a verifiable hash of invitation tokens in the `token_hash` database column,
 * so that the raw JWT is never persisted at rest.
 */
export const hashToken = (rawToken: string): string => {
  return createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generates a cryptographically random 32-byte hex string.
 * Can be used as an opaque token when a JWT-based approach is not required.
 */
export const generateSecureToken = (): string => {
  return randomBytes(32).toString('hex');
};
