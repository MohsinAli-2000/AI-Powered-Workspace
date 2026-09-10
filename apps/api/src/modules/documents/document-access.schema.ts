import { z } from 'zod';

/**
 * Validation schema for updating document access mode.
 */
export const updateDocumentAccessModeSchema = z.object({
  body: z.object({
    access_mode: z.enum(['PROJECT', 'RESTRICTED'], {
      error: 'Access mode is required and must be PROJECT or RESTRICTED.',
    }),
  }),
});

export type UpdateDocumentAccessModeInput = z.infer<
  typeof updateDocumentAccessModeSchema
>['body'];

/**
 * Validation schema for setting an individual user access rule.
 */
export const setUserAccessRuleSchema = z.object({
  body: z.object({
    user_id: z.string().uuid({ message: 'user_id must be a valid UUID.' }),
    effect: z.enum(['ALLOW', 'DENY'], {
      error: 'Effect must be either ALLOW or DENY.',
    }),
  }),
});

export type SetUserAccessRuleInput = z.infer<
  typeof setUserAccessRuleSchema
>['body'];

/**
 * Validation schema for setting a group access rule.
 */
export const setGroupAccessRuleSchema = z.object({
  body: z.object({
    group_id: z.string().uuid({ message: 'group_id must be a valid UUID.' }),
    effect: z.enum(['ALLOW', 'DENY'], {
      error: 'Effect must be either ALLOW or DENY.',
    }),
  }),
});

export type SetGroupAccessRuleInput = z.infer<
  typeof setGroupAccessRuleSchema
>['body'];

/**
 * Validation schema for setting an organization role access rule.
 */
export const setOrgRoleAccessRuleSchema = z.object({
  body: z.object({
    role: z.enum(['ADMIN', 'MEMBER'], {
      error: 'Role must be ADMIN or MEMBER (OWNER already has global access).',
    }),
    effect: z.enum(['ALLOW', 'DENY'], {
      error: 'Effect must be either ALLOW or DENY.',
    }),
  }),
});

export type SetOrgRoleAccessRuleInput = z.infer<
  typeof setOrgRoleAccessRuleSchema
>['body'];

/**
 * Validation schema for setting a project role access rule.
 */
export const setProjectRoleAccessRuleSchema = z.object({
  body: z.object({
    role: z.enum(['PROJECT_MANAGER', 'PROJECT_MEMBER'], {
      error: 'Role must be PROJECT_MANAGER or PROJECT_MEMBER.',
    }),
    effect: z.enum(['ALLOW', 'DENY'], {
      error: 'Effect must be either ALLOW or DENY.',
    }),
  }),
});

export type SetProjectRoleAccessRuleInput = z.infer<
  typeof setProjectRoleAccessRuleSchema
>['body'];

/**
 * Validation schema for target user URL parameter.
 */
export const targetUserIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Document ID must be a valid UUID.' }),
    userId: z.string().uuid({ message: 'Target user ID must be a valid UUID.' }),
  }),
});

/**
 * Validation schema for target group URL parameter.
 */
export const targetGroupIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Document ID must be a valid UUID.' }),
    groupId: z.string().uuid({ message: 'Target group ID must be a valid UUID.' }),
  }),
});

/**
 * Validation schema for target org role URL parameter.
 */
export const targetOrgRoleParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Document ID must be a valid UUID.' }),
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  }),
});

/**
 * Validation schema for target project role URL parameter.
 */
export const targetProjectRoleParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Document ID must be a valid UUID.' }),
    role: z.enum(['PROJECT_MANAGER', 'PROJECT_MEMBER']),
  }),
});
