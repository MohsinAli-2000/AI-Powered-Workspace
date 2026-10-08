import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { rateLimit } from '../../middlewares/rate-limit.middleware.js';
import {
  initiateRegisterSchema,
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

// Throttle credential endpoints per client IP (generous enough not to bother real users or local testing).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests. Please wait a few minutes before asking for another email.',
});

/**
 * Route: POST /api/v1/auth/register/initiate
 * Description: Initiate self-registration by sending email verification link
 */
authenticationRouter.post(
  '/register/initiate',
  emailLimiter,
  validateRequest(initiateRegisterSchema),
  authController.initiateRegisterHandler
);

/**
 * Route: POST /api/v1/auth/register
 * Description: Complete user account creation using verified token
 */
authenticationRouter.post(
  '/register',
  loginLimiter,
  validateRequest(registerSchema),
  authController.registerHandler
);

/**
 * Route: POST /api/v1/auth/login
 * Description: Authenticate user with credentials
 */
authenticationRouter.post(
  '/login',
  loginLimiter,
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
  emailLimiter,
  validateRequest(resendVerificationSchema),
  authController.resendVerificationHandler
);

/**
 * Route: POST /api/v1/auth/forgot-password
 * Description: Request a password reset link
 */
authenticationRouter.post(
  '/forgot-password',
  emailLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPasswordHandler
);

/**
 * Route: POST /api/v1/auth/reset-password
 * Description: Reset password with token
 */
authenticationRouter.post(
  '/reset-password',
  loginLimiter,
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
