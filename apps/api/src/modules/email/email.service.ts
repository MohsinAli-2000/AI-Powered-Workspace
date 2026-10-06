import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
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

export interface SendInvitationEmailInput {
  recipientEmail: string;
  organizationName: string;
  inviterName: string;
  assignedRole: string;
  invitationToken: string;
}

export interface SendOrganizationSuspendedEmailInput {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  reason: string;
}

export interface SendOrganizationDeletedEmailInput {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
}

/** Escapes user-controlled text before it is placed into an HTML email body. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export class EmailService {
  private readonly transporter: Transporter | null = null;
  private readonly resendClient: Resend | null = null;
  private readonly fromAddress: string;

  constructor() {
    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        // Without timeouts a blocked SMTP port hangs register / forgot-password / invite requests for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS.replace(/\s+/g, ''),
        },
      });
      this.fromAddress = env.EMAIL_FROM.includes('no-reply@example.com')
        ? `AI Workspace <${env.SMTP_USER}>`
        : env.EMAIL_FROM;
      logger.info(
        { host: env.SMTP_HOST, user: env.SMTP_USER },
        '📧 Nodemailer SMTP email service initialized.'
      );
    } else if (env.RESEND_API_KEY && env.RESEND_API_KEY.trim() !== '') {
      this.resendClient = new Resend(env.RESEND_API_KEY.trim());
      this.fromAddress = env.EMAIL_FROM;
      logger.info('📧 Resend email service initialized with API key.');
    } else {
      this.fromAddress = env.EMAIL_FROM;
      logger.warn(
        '⚠️ Neither SMTP (SMTP_USER/SMTP_PASS) nor RESEND_API_KEY configured. Outgoing emails will be logged to console (Mock mode).'
      );
    }
  }

  /**
   * Helper method to send email via Nodemailer SMTP, Resend, or log in development mode.
   */
  private async dispatchEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        logger.info(
          { messageId: info.messageId, to: options.to, subject: options.subject },
          'Email dispatched successfully via Nodemailer SMTP'
        );
        return;
      } catch (error) {
        logger.error(
          { error, to: options.to, subject: options.subject },
          'Failed to dispatch email via Nodemailer SMTP'
        );
        return;
      }
    }

    if (this.resendClient) {
      try {
        const response = await this.resendClient.emails.send({
          from: this.fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (response.error) {
          logger.error(
            { error: response.error, to: options.to, subject: options.subject },
            'Failed to dispatch email via Resend API'
          );
        } else {
          logger.info(
            { id: response.data?.id, to: options.to, subject: options.subject },
            'Email dispatched successfully via Resend'
          );
        }
      } catch (error) {
        logger.error(
          { error, to: options.to, subject: options.subject },
          'Unexpected exception when calling Resend API'
        );
      }
      return;
    }

    logger.info(
      {
        to: options.to,
        subject: options.subject,
        text: options.text,
      },
      '📧 [EMAIL SERVICE - MOCK DISPATCH] Outgoing email simulated'
    );
  }

  /**
   * Sends an email verification link to a user.
   */
  public async sendVerificationEmail(input: SendVerificationEmailInput): Promise<void> {
    const verificationUrl = `${env.CORS_ORIGIN}/verify-email?token=${encodeURIComponent(
      input.verificationToken
    )}`;

    const subject = 'Verify your email — AI Powered Workspace';
    const text = `Hello ${input.recipientName},\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThis link is valid for 24 hours.\n\nAI Powered Workspace Team`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #6366f1; font-size: 24px; font-weight: 700; margin: 0;">AI Powered Workspace</h1>
        </div>
        <div style="background: #111827; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0;">Verify your email address</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong>${escapeHtml(input.recipientName)}</strong>,
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Thanks for creating an account. Click the button below to verify your email and unlock all features.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verificationUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${verificationUrl}" style="color: #818cf8; word-break: break-all;">${verificationUrl}</a>
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
            This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    await this.dispatchEmail({
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Sends a password reset link to a user.
   */
  public async sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void> {
    const passwordResetUrl = `${env.CORS_ORIGIN}/reset-password?token=${encodeURIComponent(
      input.resetToken
    )}`;

    const subject = 'Reset your password — AI Powered Workspace';
    const text = `Hello ${input.recipientName},\n\nYou requested a password reset. Click the link below to set a new password:\n${passwordResetUrl}\n\nThis link is valid for 1 hour.\n\nAI Powered Workspace Team`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #6366f1; font-size: 24px; font-weight: 700; margin: 0;">AI Powered Workspace</h1>
        </div>
        <div style="background: #111827; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0;">Reset your password</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong>${escapeHtml(input.recipientName)}</strong>,
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to choose a new one:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${passwordResetUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${passwordResetUrl}" style="color: #818cf8; word-break: break-all;">${passwordResetUrl}</a>
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
            This link is valid for 1 hour. If you did not request this, please ignore this email or review your account security.
          </p>
        </div>
      </div>
    `;

    await this.dispatchEmail({
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Sends an organization invitation email to the specified recipient.
   */
  public async sendOrganizationInvitationEmail(input: SendInvitationEmailInput): Promise<void> {
    const invitationUrl = `${env.CORS_ORIGIN}/invitations/accept?token=${encodeURIComponent(
      input.invitationToken
    )}`;

    const subject = `You've been invited to join ${input.organizationName} on AI Powered Workspace`;
    const text = `Hello,\n\n${input.inviterName} has invited you to join ${input.organizationName} as a ${input.assignedRole}.\n\nClick the link below to accept:\n${invitationUrl}\n\nAI Powered Workspace Team`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #6366f1; font-size: 24px; font-weight: 700; margin: 0;">AI Powered Workspace</h1>
        </div>
        <div style="background: #111827; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0;">Join ${escapeHtml(input.organizationName)}</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            <strong>${escapeHtml(input.inviterName)}</strong> has invited you to join <strong>${escapeHtml(input.organizationName)}</strong> as a <strong>${escapeHtml(input.assignedRole)}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${invitationUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this link into your browser:<br/>
            <a href="${invitationUrl}" style="color: #818cf8; word-break: break-all;">${invitationUrl}</a>
          </p>
        </div>
      </div>
    `;

    await this.dispatchEmail({
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Sends an email notification to the organization owner when their organization is suspended.
   */
  public async sendOrganizationSuspendedEmail(
    input: SendOrganizationSuspendedEmailInput
  ): Promise<void> {
    const subject = `Your organization "${input.organizationName}" has been suspended — AI Powered Workspace`;
    const text = `Hello ${input.recipientName},\n\nYour organization "${input.organizationName}" has been suspended by the platform administrator.\n\nReason: ${input.reason}\n\nWhile suspended, you and your organization members will not be able to access organization projects, documents, or AI chat services. Your organization data has been preserved.\n\nIf you believe this was done in error or wish to resolve this issue, please contact platform support.\n\nAI Powered Workspace Team`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #6366f1; font-size: 24px; font-weight: 700; margin: 0;">AI Powered Workspace</h1>
        </div>
        <div style="background: #111827; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
          <div style="display: inline-block; padding: 4px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; color: #f87171; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
            Access Suspended
          </div>
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0;">Organization Access Suspended</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong>${escapeHtml(input.recipientName)}</strong>,
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Your organization <strong>${escapeHtml(input.organizationName)}</strong> has been suspended by the platform administration.
          </p>
          <div style="background: #1e1b4b; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.05em;">Suspension Reason</p>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #e2e8f0; line-height: 1.5;">${escapeHtml(input.reason)}</p>
          </div>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            While suspended, access to all workspace projects, documents, and AI chat features is temporarily disabled for all organization members. Your organization data and files are safely preserved.
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
            If you believe this action was taken in error or need to resolve compliance requirements, please contact the platform administration.
          </p>
        </div>
      </div>
    `;

    await this.dispatchEmail({
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Sends an email notification to the organization owner when their organization is permanently deleted.
   */
  public async sendOrganizationDeletedEmail(
    input: SendOrganizationDeletedEmailInput
  ): Promise<void> {
    const subject = `Your organization "${input.organizationName}" has been permanently deleted — AI Powered Workspace`;
    const text = `Hello ${input.recipientName},\n\nYour organization "${input.organizationName}" and all associated workspace data (documents, projects, conversations, vector embeddings, and storage files) have been permanently deleted by the platform administrator.\n\nThis action is irreversible.\n\nAI Powered Workspace Team`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #f8fafc; padding: 40px 24px; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h1 style="color: #6366f1; font-size: 24px; font-weight: 700; margin: 0;">AI Powered Workspace</h1>
        </div>
        <div style="background: #111827; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
          <div style="display: inline-block; padding: 4px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 9999px; color: #f87171; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
            Organization Deleted
          </div>
          <h2 style="font-size: 18px; color: #ffffff; margin-top: 0;">Organization Permanently Deleted</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Hello <strong>${escapeHtml(input.recipientName)}</strong>,
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Your organization <strong>${escapeHtml(input.organizationName)}</strong> has been permanently deleted by the platform administrator.
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            All associated data including projects, documents, vector embeddings, conversations, and uploaded files have been permanently wiped from the platform. This action is irreversible.
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; margin-bottom: 0;">
            If you have any questions, please contact the platform administration.
          </p>
        </div>
      </div>
    `;

    await this.dispatchEmail({
      to: input.recipientEmail,
      subject,
      html,
      text,
    });
  }
}


// Export singleton instance for application-wide use
export const emailService = new EmailService();
