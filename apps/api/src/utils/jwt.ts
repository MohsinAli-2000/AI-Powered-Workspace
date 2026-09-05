import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

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
    const verifiedPayload = jwt.verify(accessTokenString, env.JWT_SECRET) as AccessTokenPayload;
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
