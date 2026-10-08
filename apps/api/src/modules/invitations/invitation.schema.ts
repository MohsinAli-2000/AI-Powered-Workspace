import { z } from 'zod';

/**
 * Schema for creating a new organization invitation.
 * Validates: org UUID param, email format, role restricted to ADMIN | MEMBER.
 * OWNER is explicitly excluded per FR-MEMBER-012.
 */
export const createInvitationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  body: z.object({
    email: z
      .string()
      .trim()
      .email({ message: 'A valid email address is required' })
      .max(255, { message: 'Email address must not exceed 255 characters' }),
    role: z.enum(['ADMIN', 'MEMBER'], {
      error: 'Role must be either ADMIN or MEMBER. OWNER role cannot be assigned through invitations.',
    }),
  }),
});

/**
 * Schema for listing invitations — validates org UUID param only.
 */
export const listInvitationsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
});

/**
 * Schema for revoking an invitation — validates both org and invitation UUIDs.
 */
export const revokeInvitationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
    invitationId: z.string().uuid({ message: 'Invalid invitation identifier format' }),
  }),
});

/**
 * Schema for accepting an invitation via token.
 */
export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, { message: 'Invitation token is required' }),
  }),
});

/**
 * Schema for rejecting an invitation via token.
 */
export const rejectInvitationSchema = z.object({
  body: z.object({
    token: z
      .string()
      .min(1, { message: 'Invitation token is required' }),
  }),
});

/**
 * Schema for fetching invitation details via query token or body token.
 */
export const invitationDetailsQuerySchema = z.object({
  query: z.object({
    token: z.string().min(1, { message: 'Invitation token is required' }),
  }),
});

export const invitationDetailsBodySchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Invitation token is required' }),
  }),
});

/**
 * Schema for accepting an invitation and setting up a new user account atomically.
 */
export const acceptAndRegisterSchema = z.object({
  body: z.object({
    token: z.string().min(1, { message: 'Invitation token is required' }),
    name: z
      .string()
      .trim()
      .min(2, { message: 'Name must be at least 2 characters long' })
      .max(100, { message: 'Name must not exceed 100 characters' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .max(100, { message: 'Password must not exceed 100 characters' })
      .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  }),
});

// Inferred types for controller/service usage
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>['body'];
export type CreateInvitationParams = z.infer<typeof createInvitationSchema>['params'];
export type ListInvitationsParams = z.infer<typeof listInvitationsSchema>['params'];
export type RevokeInvitationParams = z.infer<typeof revokeInvitationSchema>['params'];
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>['body'];
export type RejectInvitationInput = z.infer<typeof rejectInvitationSchema>['body'];
export type AcceptAndRegisterInput = z.infer<typeof acceptAndRegisterSchema>['body'];
