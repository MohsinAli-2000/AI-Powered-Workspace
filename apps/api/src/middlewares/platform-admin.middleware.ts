import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

/**
 * Restricts a route to platform admins (product owners). Must run after `authenticateUser`.
 * The flag is read from the users row loaded on every request, so revoking it takes effect immediately.
 */
export const requirePlatformAdmin = (
  request: Request,
  _response: Response,
  next: NextFunction
): void => {
  if (!request.authenticatedUser) {
    next(new UnauthorizedError('Authentication required.'));
    return;
  }
  if (request.authenticatedUser.is_platform_admin !== true) {
    // Deliberately vague: don't confirm to regular users that an admin area exists.
    next(new ForbiddenError('You do not have permission to access this resource.'));
    return;
  }
  next();
};
