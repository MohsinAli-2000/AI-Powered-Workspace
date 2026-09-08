import { z } from 'zod';

/**
 * Schema for creating a new group in an organization.
 */
export const createGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, { message: 'Group name must be at least 2 characters long' })
      .max(100, { message: 'Group name cannot exceed 100 characters' }),
    description: z
      .string()
      .trim()
      .max(1000, { message: 'Group description cannot exceed 1000 characters' })
      .optional()
      .nullable(),
  }),
});

/**
 * Schema for listing groups in an organization.
 */
export const listGroupsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
});

/**
 * Schema for routes with a single group UUID parameter.
 */
export const groupIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid group identifier format' }),
  }),
});

/**
 * Schema for updating a group's name or description.
 */
export const updateGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid group identifier format' }),
  }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, { message: 'Group name must be at least 2 characters long' })
        .max(100, { message: 'Group name cannot exceed 100 characters' })
        .optional(),
      description: z
        .string()
        .trim()
        .max(1000, { message: 'Group description cannot exceed 1000 characters' })
        .optional()
        .nullable(),
    })
    .refine(
      (data) => data.name !== undefined || data.description !== undefined,
      {
        message: 'At least one field (name or description) must be provided to update',
      }
    ),
});

/**
 * Schema for adding a member to a group.
 * Supports both `userId` and `user_id` parameter styles.
 */
export const addGroupMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid group identifier format' }),
  }),
  body: z
    .object({
      userId: z.string().uuid({ message: 'Invalid user identifier format' }).optional(),
      user_id: z.string().uuid({ message: 'Invalid user identifier format' }).optional(),
    })
    .refine((data) => Boolean(data.userId || data.user_id), {
      message: 'User identifier (userId or user_id) is required',
    }),
});

/**
 * Schema for removing a member from a group.
 */
export const removeGroupMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid group identifier format' }),
    userId: z.string().uuid({ message: 'Invalid user identifier format' }),
  }),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>['body'];
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>['body'];
export type AddGroupMemberInput = {
  userId: string;
};
