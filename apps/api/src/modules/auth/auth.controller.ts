import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthService } from './auth.service.js';
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.schema.js';

export class AuthController {
  constructor(private readonly authenticationService: AuthService = authService) {}

  /**
   * Handles user registration.
   */
  public registerHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, RegisterInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const registrationPayload = incomingRequest.body;
      const authenticationResult = await this.authenticationService.registerUser(registrationPayload);

      outgoingResponse.status(201).json({
        success: true,
        message: 'User account registered successfully. A verification email has been dispatched.',
        data: {
          user: authenticationResult.authenticatedUser,
          tokens: {
            accessToken: authenticationResult.accessTokenString,
            refreshToken: authenticationResult.refreshTokenString,
          },
        },
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles user login with email and password.
   */
  public loginHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, LoginInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const loginCredentials = incomingRequest.body;
      const authenticationResult = await this.authenticationService.loginUser(loginCredentials);

      outgoingResponse.status(200).json({
        success: true,
        message: 'User logged in successfully.',
        data: {
          user: authenticationResult.authenticatedUser,
          tokens: {
            accessToken: authenticationResult.accessTokenString,
            refreshToken: authenticationResult.refreshTokenString,
          },
        },
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles token refresh to renew expired access tokens.
   */
  public refreshTokenHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, RefreshTokenInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const tokenRefreshPayload = incomingRequest.body;
      const refreshResult = await this.authenticationService.refreshUserToken(tokenRefreshPayload);

      outgoingResponse.status(200).json({
        success: true,
        message: 'Authentication token refreshed successfully.',
        data: {
          tokens: {
            accessToken: refreshResult.accessTokenString,
            refreshToken: refreshResult.refreshTokenString,
          },
        },
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Returns the profile of the currently authenticated user.
   */
  public getCurrentUserHandler = async (
    incomingRequest: Request,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      outgoingResponse.status(200).json({
        success: true,
        message: 'Authenticated user profile retrieved successfully.',
        data: {
          user: incomingRequest.authenticatedUser,
        },
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles email address verification with a token.
   */
  public verifyEmailHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, VerifyEmailInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const verifiedUser = await this.authenticationService.verifyUserEmail(incomingRequest.body);

      outgoingResponse.status(200).json({
        success: true,
        message: 'Email address verified successfully.',
        data: {
          user: verifiedUser,
        },
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles resending the email verification link.
   */
  public resendVerificationHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, ResendVerificationInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      await this.authenticationService.resendVerificationEmail(incomingRequest.body);

      outgoingResponse.status(200).json({
        success: true,
        message: 'If the account exists and is unverified, a new verification link has been sent.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles requesting a password reset link.
   */
  public forgotPasswordHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, ForgotPasswordInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      await this.authenticationService.requestPasswordReset(incomingRequest.body);

      outgoingResponse.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been dispatched.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles resetting a user's password using a reset token.
   */
  public resetPasswordHandler = async (
    incomingRequest: Request<Record<string, never>, unknown, ResetPasswordInput>,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      await this.authenticationService.resetUserPassword(incomingRequest.body);

      outgoingResponse.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };

  /**
   * Handles user logout.
   */
  public logoutHandler = async (
    _incomingRequest: Request,
    outgoingResponse: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      outgoingResponse.status(200).json({
        success: true,
        message: 'User logged out successfully. Active session ended.',
      });
    } catch (controllerError) {
      nextMiddleware(controllerError);
    }
  };
}

// Export singleton instance for application-wide routing
export const authController = new AuthController();
