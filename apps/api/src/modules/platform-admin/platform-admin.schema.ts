import { z } from 'zod';

const organizationIdParams = z.object({
  id: z.string().uuid({ message: 'Invalid organization identifier format' }),
});

export const listAdminOrganizationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().trim().max(200).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }),
});

export const suspendOrganizationSchema = z.object({
  params: organizationIdParams,
  body: z
    .object({
      reason: z.string().trim().max(1000).optional(),
    })
    .optional()
    .default({}),
});

export const reactivateOrganizationSchema = z.object({
  params: organizationIdParams,
});

export const deleteOrganizationSchema = z.object({
  params: organizationIdParams,
});

