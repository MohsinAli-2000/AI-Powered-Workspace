import { userRepository, type UserRepository } from '../users/user.repository.js';
import { toSafeUser, type SafeUser } from '../users/user.entity.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { ConflictError, UnauthorizedError } from '../../errors/app-error.js';
import type { RegisterInput, LoginInput, RefreshTokenInput } from './auth.schema.js';

export interface AuthenticationResult {
  authenticatedUser: SafeUser;
  accessTokenString: string;
  refreshTokenString: string;
}

export interface TokenRefreshResult {
  accessTokenString: string;
  refreshTokenString: string;
}

export class AuthService {
  constructor(private readonly userStore: UserRepository = userRepository) {}

  /**
   * Registers a new user account with secure password hashing and issues initial auth tokens.
   */
  public async registerUser(
    registrationInput: RegisterInput
  ): Promise<AuthenticationResult> {
    const existingUser = await this.userStore.findByEmail(registrationInput.email);

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const securePasswordHash = await hashPassword(registrationInput.password);

    const newlyCreatedUser = await this.userStore.create({
      email: registrationInput.email,
      password_hash: securePasswordHash,
      name: registrationInput.name,
    });

    const accessTokenString = generateAccessToken({
      userId: newlyCreatedUser.id,
      email: newlyCreatedUser.email,
    });

    const refreshTokenString = generateRefreshToken({
      userId: newlyCreatedUser.id,
    });

    return {
      authenticatedUser: toSafeUser(newlyCreatedUser),
      accessTokenString,
      refreshTokenString,
    };
  }

  /**
   * Authenticates a user with email and password, issuing fresh tokens upon success.
   */
  public async loginUser(
    loginCredentials: LoginInput
  ): Promise<AuthenticationResult> {
    const matchedUser = await this.userStore.findByEmail(loginCredentials.email);

    // Constant-time message to prevent username/email harvesting
    const invalidCredentialsMessage = 'Invalid email address or password.';

    if (!matchedUser) {
      throw new UnauthorizedError(invalidCredentialsMessage);
    }

    const isPasswordCorrect = await comparePassword(
      loginCredentials.password,
      matchedUser.password_hash
    );

    if (!isPasswordCorrect) {
      throw new UnauthorizedError(invalidCredentialsMessage);
    }

    const accessTokenString = generateAccessToken({
      userId: matchedUser.id,
      email: matchedUser.email,
    });

    const refreshTokenString = generateRefreshToken({
      userId: matchedUser.id,
    });

    return {
      authenticatedUser: toSafeUser(matchedUser),
      accessTokenString,
      refreshTokenString,
    };
  }

  /**
   * Validates a refresh token and generates a new pair of tokens.
   */
  public async refreshUserToken(
    refreshTokenPayload: RefreshTokenInput
  ): Promise<TokenRefreshResult> {
    const decodedToken = verifyRefreshToken(refreshTokenPayload.refreshToken);

    const existingUser = await this.userStore.findById(decodedToken.userId);

    if (!existingUser) {
      throw new UnauthorizedError('User account associated with this session no longer exists.');
    }

    const newAccessTokenString = generateAccessToken({
      userId: existingUser.id,
      email: existingUser.email,
    });

    const newRefreshTokenString = generateRefreshToken({
      userId: existingUser.id,
    });

    return {
      accessTokenString: newAccessTokenString,
      refreshTokenString: newRefreshTokenString,
    };
  }
}

// Export singleton instance for application-wide use
export const authService = new AuthService();
