import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthService } from './auth.service.js';
import type { RegisterInput, LoginInput, RefreshTokenInput } from './auth.schema.js';

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
        message: 'User account registered successfully.',
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
}

// Export singleton instance for application-wide routing
export const authController = new AuthController();
