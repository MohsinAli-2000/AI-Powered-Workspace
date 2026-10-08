import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
  /** Fingerprint of the password hash the session was created with; a password reset changes it. */
  pwv?: string;
}

/** Short fingerprint of a password hash, embedded in refresh tokens. */
export const passwordFingerprint = (passwordHash: string): string => passwordHash.slice(-16);

/**
 * Signs a short-lived access token containing user identity claims.
 */
export const generateAccessToken = (tokenPayload: AccessTokenPayload): string => {
  const accessTokenString = jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return accessTokenString;
};

/**
 * Verifies and decodes a short-lived access token.
 * Throws an UnauthorizedError (401) if invalid or expired.
 */
export const verifyAccessToken = (accessTokenString: string): AccessTokenPayload => {
  try {
    const verifiedPayload = jwt.verify(accessTokenString, env.JWT_SECRET) as AccessTokenPayload & {
      purpose?: string;
    };
    // Email-verification, password-reset and invitation tokens share this secret; they must never be
    // accepted as login credentials.
    if (verifiedPayload.purpose !== undefined || !verifiedPayload.userId) {
      throw new jwt.JsonWebTokenError('Token is not an access token');
    }
    return verifiedPayload;
  } catch (jwtVerificationError) {
    if (jwtVerificationError instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired. Please refresh your session.');
    }
    throw new UnauthorizedError('Invalid access token provided.');
  }
};

/**
 * Signs a long-lived refresh token.
 */
export const generateRefreshToken = (tokenPayload: RefreshTokenPayload): string => {
  const refreshTokenString = jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return refreshTokenString;
};

/**
 * Verifies and decodes a long-lived refresh token.
 * Throws an UnauthorizedError (401) if invalid or expired.
 */
export const verifyRefreshToken = (refreshTokenString: string): RefreshTokenPayload => {
  try {
    const verifiedPayload = jwt.verify(refreshTokenString, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    return verifiedPayload;
  } catch (jwtVerificationError) {
    if (jwtVerificationError instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }
    throw new UnauthorizedError('Invalid refresh token provided.');
  }
};

export interface EmailVerificationTokenPayload {
  email?: string;
  userId?: string;
  purpose: 'email_verification';
}

/**
 * Signs a 24-hour verification token for email confirmation.
 * Supports email (pre-registration) or userId (legacy).
 */
export const generateEmailVerificationToken = (identifier: string): string => {
  const payload: EmailVerificationTokenPayload = identifier.includes('@')
    ? { email: identifier.toLowerCase(), purpose: 'email_verification' }
    : { userId: identifier, purpose: 'email_verification' };
  const tokenString = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '24h',
  });
  return tokenString;
};

/**
 * Verifies and decodes an email verification token.
 * Throws an UnauthorizedError (401) if invalid or expired.
 */
export const verifyEmailVerificationToken = (
  tokenString: string
): EmailVerificationTokenPayload => {
  try {
    const verifiedPayload = jwt.verify(
      tokenString,
      env.JWT_SECRET
    ) as EmailVerificationTokenPayload;

    if (verifiedPayload.purpose !== 'email_verification') {
      throw new UnauthorizedError('Invalid token purpose. Expected email verification token.');
    }

    return verifiedPayload;
  } catch (jwtVerificationError) {
    if (jwtVerificationError instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Email verification link has expired. Please request a new one.');
    }
    if (jwtVerificationError instanceof UnauthorizedError) {
      throw jwtVerificationError;
    }
    throw new UnauthorizedError('Invalid email verification token.');
  }
};

export interface PasswordResetTokenPayload {
  userId: string;
  hashFingerprint: string;
  purpose: 'password_reset';
}

/**
 * Signs a 1-hour time-limited password reset token.
 * Embeds a fingerprint of the current password hash so the token is invalidated immediately once the password changes.
 */
export const generatePasswordResetToken = (
  userId: string,
  currentPasswordHash: string
): string => {
  const payload: PasswordResetTokenPayload = {
    userId,
    hashFingerprint: currentPasswordHash.slice(-16),
    purpose: 'password_reset',
  };
  const tokenString = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '1h',
  });
  return tokenString;
};

/**
 * Verifies and decodes a password reset token.
 * Throws an UnauthorizedError (401) if invalid or expired.
 */
export const verifyPasswordResetToken = (
  tokenString: string
): PasswordResetTokenPayload => {
  try {
    const verifiedPayload = jwt.verify(
      tokenString,
      env.JWT_SECRET
    ) as PasswordResetTokenPayload;

    if (verifiedPayload.purpose !== 'password_reset') {
      throw new UnauthorizedError('Invalid token purpose. Expected password reset token.');
    }

    return verifiedPayload;
  } catch (jwtVerificationError) {
    if (jwtVerificationError instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Password reset link has expired. Please request a new one.');
    }
    if (jwtVerificationError instanceof UnauthorizedError) {
      throw jwtVerificationError;
    }
    throw new UnauthorizedError('Invalid password reset token.');
  }
};

// ---------------------------------------------------------------------------
// Organization Invitation Tokens
// ---------------------------------------------------------------------------

export interface InvitationTokenPayload {
  invitationId: string;
  email: string;
  organizationId: string;
  purpose: 'organization_invitation';
}

/**
 * Signs a 7-day invitation token containing the invitation identity, target email,
 * and organization context. The raw JWT is sent to the invitee via email;
 * a SHA-256 hash is stored in the `token_hash` column for server-side lookup.
 */
export const generateInvitationToken = (
  invitationId: string,
  email: string,
  organizationId: string
): string => {
  const payload: InvitationTokenPayload = {
    invitationId,
    email,
    organizationId,
    purpose: 'organization_invitation',
  };
  const tokenString = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
  });
  return tokenString;
};

/**
 * Verifies and decodes an organization invitation token.
 * Throws an UnauthorizedError (401) if invalid or expired.
 */
export const verifyInvitationToken = (
  tokenString: string
): InvitationTokenPayload => {
  try {
    const verifiedPayload = jwt.verify(
      tokenString,
      env.JWT_SECRET
    ) as InvitationTokenPayload;

    if (verifiedPayload.purpose !== 'organization_invitation') {
      throw new UnauthorizedError('Invalid token purpose. Expected organization invitation token.');
    }

    return verifiedPayload;
  } catch (jwtVerificationError) {
    if (jwtVerificationError instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Invitation link has expired. Please request a new invitation.');
    }
    if (jwtVerificationError instanceof UnauthorizedError) {
      throw jwtVerificationError;
    }
    throw new UnauthorizedError('Invalid invitation token.');
  }
};
