import { z } from 'zod';

/**
 * Schema for creating a new project in an organization.
 */
export const createProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Project name is required' })
      .max(100, { message: 'Project name cannot exceed 100 characters' }),
    description: z
      .string()
      .trim()
      .max(1000, { message: 'Project description cannot exceed 1000 characters' })
      .optional()
      .nullable(),
  }),
});

/**
 * Schema for listing projects in an organization.
 */
export const listProjectsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
});

/**
 * Schema for routes with a single project UUID parameter.
 */
export const projectIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
  }),
});

/**
 * Schema for updating a project's details.
 */
export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
  }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { message: 'Project name cannot be empty' })
        .max(100, { message: 'Project name cannot exceed 100 characters' })
        .optional(),
      description: z
        .string()
        .trim()
        .max(1000, { message: 'Project description cannot exceed 1000 characters' })
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
 * Schema for adding an organization member to a project.
 */
export const addProjectMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
  }),
  body: z.object({
    userId: z.string().uuid({ message: 'Invalid user identifier format' }),
    role: z.enum(['PROJECT_MANAGER', 'PROJECT_MEMBER'], {
      error: 'Role must be either PROJECT_MANAGER or PROJECT_MEMBER',
    }),
  }),
});

/**
 * Schema for updating a project member's role.
 */
export const updateProjectMemberRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
    userId: z.string().uuid({ message: 'Invalid user identifier format' }),
  }),
  body: z.object({
    role: z.enum(['PROJECT_MANAGER', 'PROJECT_MEMBER'], {
      error: 'Role must be either PROJECT_MANAGER or PROJECT_MEMBER',
    }),
  }),
});

/**
 * Schema for removing a member from a project.
 */
export const removeProjectMemberSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
    userId: z.string().uuid({ message: 'Invalid user identifier format' }),
  }),
});

/**
 * Inferred input types for controllers and services.
 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>['body'];
export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleSchema>['body'];
