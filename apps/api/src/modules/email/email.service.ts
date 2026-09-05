import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface SendVerificationEmailInput {
  recipientEmail: string;
  recipientName: string;
  verificationToken: string;
}

export interface SendPasswordResetEmailInput {
  recipientEmail: string;
  recipientName: string;
  resetToken: string;
}

export class EmailService {
  /**
   * Sends an email verification link to a user.
   */
  public async sendVerificationEmail(
    input: SendVerificationEmailInput
  ): Promise<void> {
    const verificationUrl = `${env.CORS_ORIGIN}/verify-email?token=${encodeURIComponent(
      input.verificationToken
    )}`;

    logger.info(
      {
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        verificationUrl,
      },
      '📧 [EMAIL SERVICE] Email verification link dispatched'
    );
  }

  /**
   * Sends a password reset link to a user.
   */
  public async sendPasswordResetEmail(
    input: SendPasswordResetEmailInput
  ): Promise<void> {
    const passwordResetUrl = `${env.CORS_ORIGIN}/reset-password?token=${encodeURIComponent(
      input.resetToken
    )}`;

    logger.info(
      {
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        passwordResetUrl,
      },
      '📧 [EMAIL SERVICE] Password reset link dispatched'
    );
  }
}

// Export singleton instance for application-wide use
export const emailService = new EmailService();
