import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../modules/users/user.repository.js';
import { toSafeUser, type SafeUser } from '../modules/users/user.entity.js';
import { UnauthorizedError } from '../errors/app-error.js';

// Extend Express Request interface to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: SafeUser;
    }
  }
}

/**
 * Middleware that verifies the Bearer JWT token and attaches the authenticated user to the request.
 */
export const authenticateUser = async (
  incomingRequest: Request,
  _outgoingResponse: Response,
  nextMiddleware: NextFunction
): Promise<void> => {
  try {
    const authorizationHeader = incomingRequest.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required. Please provide a Bearer access token.');
    }

    const accessTokenString = authorizationHeader.split(' ')[1];

    if (!accessTokenString) {
      throw new UnauthorizedError('Malformed authorization header. Token is missing.');
    }

    const decodedTokenPayload = verifyAccessToken(accessTokenString);

    const matchedUser = await userRepository.findById(decodedTokenPayload.userId);

    if (!matchedUser) {
      throw new UnauthorizedError('User account associated with this token no longer exists.');
    }

    // Attach sanitized user to the request object for downstream handlers
    incomingRequest.authenticatedUser = toSafeUser(matchedUser);

    nextMiddleware();
  } catch (authenticationError) {
    nextMiddleware(authenticationError);
  }
};
