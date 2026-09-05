export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  name: string;
}

/**
 * Sanitized user object without sensitive credential fields.
 */
export type SafeUser = Omit<User, 'password_hash'>;

/**
 * Helper to strip sensitive fields from a user entity.
 */
export const toSafeUser = (user: User): SafeUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safeUser } = user;
  return safeUser;
};
