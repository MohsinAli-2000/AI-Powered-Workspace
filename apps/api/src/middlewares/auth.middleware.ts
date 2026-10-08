import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { userRepository } from '../modules/users/user.repository.js';
import { toSafeUser, type SafeUser } from '../modules/users/user.entity.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

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
  // Several routers are mounted on the same prefix and each applies this middleware; once a request has been
  // authenticated there is no need to verify the token and hit the users table again.
  if (incomingRequest.authenticatedUser) {
    nextMiddleware();
    return;
  }

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

    if (!matchedUser.email_verified_at) {
      throw new ForbiddenError('Email address is not verified. Please verify your email to access this resource.', {
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Attach sanitized user to the request object for downstream handlers
    incomingRequest.authenticatedUser = toSafeUser(matchedUser);

    nextMiddleware();
  } catch (authenticationError) {
    nextMiddleware(authenticationError);
  }
};
