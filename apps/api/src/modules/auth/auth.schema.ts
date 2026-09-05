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

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];

