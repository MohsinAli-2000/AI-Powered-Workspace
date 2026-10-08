import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'Please provide a valid email address' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .max(100, { message: 'Password must not exceed 100 characters' })
      .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
    name: z
      .string()
      .trim()
      .min(2, { message: 'Name must be at least 2 characters long' })
      .max(100, { message: 'Name must not exceed 100 characters' }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'Please provide a valid email address' }),
    password: z
      .string()
      .min(1, { message: 'Password is required' }),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, { message: 'Refresh token is required' }),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, { message: 'Verification token is required' }),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'Please provide a valid email address' }),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'Please provide a valid email address' }),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.preprocess(
    (raw: unknown) => {
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (!obj.newPassword && obj.new_password) {
          return { ...obj, newPassword: obj.new_password };
        }
      }
      return raw;
    },
    z.object({
      token: z
        .string()
        .min(1, { message: 'Password reset token is required' }),
      newPassword: z
        .string()
        .min(8, { message: 'Password must be at least 8 characters long' })
        .max(100, { message: 'Password must not exceed 100 characters' })
        .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
        .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
    })
  ),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];

