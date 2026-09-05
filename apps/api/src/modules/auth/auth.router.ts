import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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

/**
 * Route: POST /api/v1/auth/verify-email
 * Description: Verify user email using verification token
 */
authenticationRouter.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  authController.verifyEmailHandler
);

/**
 * Route: POST /api/v1/auth/resend-verification
 * Description: Resend verification email to user
 */
authenticationRouter.post(
  '/resend-verification',
  validateRequest(resendVerificationSchema),
  authController.resendVerificationHandler
);

/**
 * Route: POST /api/v1/auth/forgot-password
 * Description: Request a password reset link
 */
authenticationRouter.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  authController.forgotPasswordHandler
);

/**
 * Route: POST /api/v1/auth/reset-password
 * Description: Reset password with token
 */
authenticationRouter.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  authController.resetPasswordHandler
);

/**
 * Route: POST /api/v1/auth/logout
 * Description: Log out an authenticated user session
 */
authenticationRouter.post(
  '/logout',
  authenticateUser,
  authController.logoutHandler
);

export const authRouter = authenticationRouter;
