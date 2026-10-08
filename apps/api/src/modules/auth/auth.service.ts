import { BaseRepository } from '../../db/base.repository.js';
import { userRepository, type UserRepository } from '../users/user.repository.js';
import {
  emailVerificationRepository,
  type EmailVerificationRepository,
} from './email-verification.repository.js';
import { toSafeUser, type SafeUser } from '../users/user.entity.js';
import { emailService, type EmailService } from '../email/email.service.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { hashToken } from '../../utils/crypto.js';
import {
  generateAccessToken,
  generateRefreshToken,
  passwordFingerprint,
  verifyRefreshToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from '../../utils/jwt.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../errors/app-error.js';
import type {
  InitiateRegisterInput,
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
    private readonly mailer: EmailService = emailService,
    private readonly verificationStore: EmailVerificationRepository = emailVerificationRepository
  ) {}

  /**
   * Initiates user self-registration by sending an email verification link.
   * Crucially, does NOT create a user record in the database until email is verified.
   */
  public async initiateRegistration(
    input: InitiateRegisterInput
  ): Promise<void> {
    const existingUser = await this.userStore.findByEmail(input.email);

    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const verificationToken = generateEmailVerificationToken(input.email);
    const tokenHash = hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.verificationStore.create({
      email: input.email.toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    await this.mailer.sendVerificationEmail({
      recipientEmail: input.email,
      recipientName: input.email.split('@')[0],
      verificationToken,
    });
  }

  /**
   * Completes user account creation after email verification has been confirmed.
   * Atomically consumes the verification token, creates the user account (already verified),
   * and automatically issues authentication tokens.
   */
  public async registerUser(
    registrationInput: RegisterInput
  ): Promise<AuthenticationResult> {
    const decodedToken = verifyEmailVerificationToken(registrationInput.token);
    const tokenHash = hashToken(registrationInput.token);

    const verification = await this.verificationStore.findByTokenHash(tokenHash);
    if (!verification) {
      throw new NotFoundError('Verification token not found or has been invalidated.');
    }

    if (verification.status === 'CONSUMED') {
      throw new ConflictError('This verification token has already been used.');
    }

    if (new Date(verification.expires_at) <= new Date()) {
      throw new UnauthorizedError('Email verification link has expired. Please request a new one.');
    }

    const email = verification.email;
    const existingUser = await this.userStore.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const securePasswordHash = await hashPassword(registrationInput.password);

    const newlyCreatedUser = await BaseRepository.withTransaction(async (transactionClient) => {
      // 1. Consume the token atomically to prevent replay attacks
      const consumed = await this.verificationStore.transitionToConsumed(
        verification.id,
        transactionClient
      );
      if (!consumed) {
        throw new ConflictError('This verification token has already been used.');
      }

      // 2. Create the user with email_verified_at set to NOW()
      return this.userStore.create(
        {
          email,
          password_hash: securePasswordHash,
          name: registrationInput.name,
          email_verified_at: new Date(),
        },
        transactionClient
      );
    });

    const accessTokenString = generateAccessToken({
      userId: newlyCreatedUser.id,
      email: newlyCreatedUser.email,
    });

    const refreshTokenString = generateRefreshToken({
      userId: newlyCreatedUser.id,
      pwv: passwordFingerprint(newlyCreatedUser.password_hash),
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

    if (!matchedUser.email_verified_at) {
      throw new ForbiddenError(
        'Your email address has not been verified. Please verify your email first.',
        { code: 'EMAIL_NOT_VERIFIED' }
      );
    }

    const accessTokenString = generateAccessToken({
      userId: matchedUser.id,
      email: matchedUser.email,
    });

    const refreshTokenString = generateRefreshToken({
      userId: matchedUser.id,
      pwv: passwordFingerprint(matchedUser.password_hash),
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

    if (!existingUser.email_verified_at) {
      throw new ForbiddenError(
        'Your email address has not been verified. Please verify your email first.',
        { code: 'EMAIL_NOT_VERIFIED' }
      );
    }

    // A password reset invalidates every session created before it (older tokens carry no/other fingerprint).
    if (
      decodedToken.pwv !== undefined &&
      decodedToken.pwv !== passwordFingerprint(existingUser.password_hash)
    ) {
      throw new UnauthorizedError('Your password was changed. Please log in again.');
    }

    const newAccessTokenString = generateAccessToken({
      userId: existingUser.id,
      email: existingUser.email,
    });

    const newRefreshTokenString = generateRefreshToken({
      userId: existingUser.id,
      pwv: passwordFingerprint(existingUser.password_hash),
    });

    return {
      accessTokenString: newAccessTokenString,
      refreshTokenString: newRefreshTokenString,
    };
  }

  /**
   * Verifies an email verification token before account creation.
   * If a legacy token with userId is passed, marks that user as verified.
   */
  public async verifyUserEmail(
    verificationInput: VerifyEmailInput
  ): Promise<{ email: string; verified: boolean; user?: SafeUser }> {
    const decodedToken = verifyEmailVerificationToken(verificationInput.token);

    if (decodedToken.email) {
      const tokenHash = hashToken(verificationInput.token);
      const verification = await this.verificationStore.findByTokenHash(tokenHash);

      if (!verification) {
        throw new NotFoundError('Verification token not found or has been invalidated.');
      }

      if (verification.status === 'CONSUMED') {
        throw new BadRequestError('This verification token has already been used.');
      }

      if (new Date(verification.expires_at) <= new Date()) {
        throw new UnauthorizedError('Email verification link has expired. Please request a new one.');
      }

      if (verification.status === 'PENDING') {
        await this.verificationStore.markVerified(verification.id);
      }

      return {
        email: verification.email,
        verified: true,
      };
    }

    if (decodedToken.userId) {
      const matchedUser = await this.userStore.findById(decodedToken.userId);

      if (!matchedUser) {
        throw new UnauthorizedError('User account associated with this verification link no longer exists.');
      }

      if (matchedUser.email_verified_at) {
        return { email: matchedUser.email, verified: true, user: toSafeUser(matchedUser) };
      }

      const updatedVerifiedUser = await this.userStore.markEmailVerified(matchedUser.id);
      return { email: updatedVerifiedUser!.email, verified: true, user: toSafeUser(updatedVerifiedUser!) };
    }

    throw new UnauthorizedError('Invalid email verification token payload.');
  }

  /**
   * Resends an email verification link to an unverified email address.
   */
  public async resendVerificationEmail(
    resendInput: ResendVerificationInput
  ): Promise<void> {
    const matchedUser = await this.userStore.findByEmail(resendInput.email);

    // If an account already exists and is already verified, do not send verification link
    if (matchedUser && matchedUser.email_verified_at) {
      return;
    }

    const emailVerificationToken = generateEmailVerificationToken(resendInput.email);
    const tokenHash = hashToken(emailVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.verificationStore.create({
      email: resendInput.email.toLowerCase(),
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    await this.mailer.sendVerificationEmail({
      recipientEmail: resendInput.email,
      recipientName: matchedUser ? matchedUser.name : resendInput.email.split('@')[0],
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
