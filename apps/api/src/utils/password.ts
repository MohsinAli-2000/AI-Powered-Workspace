import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * Hashes a plain text password using bcrypt with the configured salt rounds.
 *
 * @param plainTextPassword - The raw password entered by the user.
 * @returns The secure bcrypt password hash string to store in the database.
 */
export const hashPassword = async (plainTextPassword: string): Promise<string> => {
  const generatedSalt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(plainTextPassword, generatedSalt);
  return passwordHash;
};

/**
 * Verifies whether a supplied plain text password matches the stored bcrypt hash.
 *
 * @param plainTextPassword - The raw password provided during authentication.
 * @param storedPasswordHash - The bcrypt hash retrieved from the database.
 * @returns True if the password matches, false otherwise.
 */
export const comparePassword = async (
  plainTextPassword: string,
  storedPasswordHash: string
): Promise<boolean> => {
  const isPasswordMatching = await bcrypt.compare(plainTextPassword, storedPasswordHash);
  return isPasswordMatching;
};
