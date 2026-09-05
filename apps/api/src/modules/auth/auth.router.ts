import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from './auth.schema.js';
import { authController } from './auth.controller.js';

const authenticationRouter = Router();

/**
 * Route: POST /api/v1/auth/register
 * Description: Register a new user account
 */
authenticationRouter.post(
  '/register',
  validateRequest(registerSchema),
  authController.registerHandler
);

/**
 * Route: POST /api/v1/auth/login
 * Description: Authenticate user with credentials
 */
authenticationRouter.post(
  '/login',
  validateRequest(loginSchema),
  authController.loginHandler
);

/**
 * Route: POST /api/v1/auth/refresh
 * Description: Refresh expired access token
 */
authenticationRouter.post(
  '/refresh',
  validateRequest(refreshTokenSchema),
  authController.refreshTokenHandler
);

/**
 * Route: GET /api/v1/auth/me
 * Description: Retrieve current authenticated user profile (protected)
 */
authenticationRouter.get(
  '/me',
  authenticateUser,
  authController.getCurrentUserHandler
);

export const authRouter = authenticationRouter;
