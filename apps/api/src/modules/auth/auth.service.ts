import { userRepository, type UserRepository } from '../users/user.repository.js';
import { toSafeUser, type SafeUser } from '../users/user.entity.js';
import { emailService, type EmailService } from '../email/email.service.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from '../../utils/jwt.js';
import { ConflictError, UnauthorizedError } from '../../errors/app-error.js';
import type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.schema.js';

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
  constructor(
    private readonly userStore: UserRepository = userRepository,
    private readonly mailer: EmailService = emailService
  ) {}

  /**
   * Registers a new user account with secure password hashing, dispatches email verification, and issues initial auth tokens.
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

    // Generate email verification token and send verification email
    const emailVerificationToken = generateEmailVerificationToken(newlyCreatedUser.id);
    await this.mailer.sendVerificationEmail({
      recipientEmail: newlyCreatedUser.email,
      recipientName: newlyCreatedUser.name,
      verificationToken: emailVerificationToken,
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

  /**
   * Verifies a user's email address using a valid verification token.
   */
  public async verifyUserEmail(
    verificationInput: VerifyEmailInput
  ): Promise<SafeUser> {
    const decodedToken = verifyEmailVerificationToken(verificationInput.token);

    const matchedUser = await this.userStore.findById(decodedToken.userId);

    if (!matchedUser) {
      throw new UnauthorizedError('User account associated with this verification link no longer exists.');
    }

    if (matchedUser.email_verified_at) {
      return toSafeUser(matchedUser); // already verified
    }

    const updatedVerifiedUser = await this.userStore.markEmailVerified(matchedUser.id);
    return toSafeUser(updatedVerifiedUser!);
  }

  /**
   * Resends an email verification link to an unverified user account.
   */
  public async resendVerificationEmail(
    resendInput: ResendVerificationInput
  ): Promise<void> {
    const matchedUser = await this.userStore.findByEmail(resendInput.email);

    // Prevent account enumeration: do not reveal whether the email exists or is verified
    if (!matchedUser || matchedUser.email_verified_at) {
      return;
    }

    const emailVerificationToken = generateEmailVerificationToken(matchedUser.id);
    await this.mailer.sendVerificationEmail({
      recipientEmail: matchedUser.email,
      recipientName: matchedUser.name,
      verificationToken: emailVerificationToken,
    });
  }

  /**
   * Initiates a password reset request by sending a reset link to the user's email.
   */
  public async requestPasswordReset(
    forgotPasswordInput: ForgotPasswordInput
  ): Promise<void> {
    const matchedUser = await this.userStore.findByEmail(forgotPasswordInput.email);

    // Prevent account enumeration: do not reveal whether the email exists
    if (!matchedUser) {
      return;
    }

    const resetTokenString = generatePasswordResetToken(
      matchedUser.id,
      matchedUser.password_hash
    );

    await this.mailer.sendPasswordResetEmail({
      recipientEmail: matchedUser.email,
      recipientName: matchedUser.name,
      resetToken: resetTokenString,
    });
  }

  /**
   * Resets a user's password after verifying the reset token.
   */
  public async resetUserPassword(
    resetPasswordInput: ResetPasswordInput
  ): Promise<void> {
    const decodedToken = verifyPasswordResetToken(resetPasswordInput.token);

    const matchedUser = await this.userStore.findById(decodedToken.userId);

    if (!matchedUser) {
      throw new UnauthorizedError('User account associated with this reset link no longer exists.');
    }

    // Verify that the token has not already been invalidated by a previous password change
    if (matchedUser.password_hash.slice(-16) !== decodedToken.hashFingerprint) {
      throw new UnauthorizedError('This password reset link has already been used or is no longer valid.');
    }

    const newPasswordHash = await hashPassword(resetPasswordInput.newPassword);

    await this.userStore.updatePassword(matchedUser.id, newPasswordHash);
  }
}

// Export singleton instance for application-wide use
export const authService = new AuthService();
