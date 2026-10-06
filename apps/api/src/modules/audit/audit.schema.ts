import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(25),
    action: z.string().trim().optional(),
    resourceType: z.string().trim().optional(),
    actorUserId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const auditLogOrgParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization identifier format' }),
  }),
});
