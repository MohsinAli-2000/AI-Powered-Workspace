import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, { message: 'Organization name must be at least 2 characters long' })
      .max(100, { message: 'Organization name must not exceed 100 characters' }),
  }),
});

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, { message: 'Organization name must be at least 2 characters long' })
      .max(100, { message: 'Organization name must not exceed 100 characters' }),
  }),
});

export const transferOwnershipSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  body: z.object({
    newOwnerUserId: z
      .string()
      .uuid({ message: 'newOwnerUserId must be a valid user UUID' }),
  }),
});

export const organizationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>['body'];
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>['body'];
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>['body'];
export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>['params'];
