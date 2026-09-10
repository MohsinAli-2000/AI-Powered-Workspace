import { z } from 'zod';

export const createConversationBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Title must not be empty' })
    .max(255, { message: 'Title must not exceed 255 characters' })
    .optional(),
  project_ids: z
    .array(z.string().uuid({ message: 'Each project_id must be a valid UUID' }))
    .optional()
    .default([]),
});

export const createConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid organization ID' }),
  }),
  body: createConversationBodySchema,
});

export const updateConversationBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Title must be at least 1 character long' })
    .max(255, { message: 'Title must not exceed 255 characters' }),
});

export const updateConversationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid conversation ID' }),
  }),
  body: updateConversationBodySchema,
});

export const sendMessageBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: 'Message content cannot be empty' })
    .max(4000, { message: 'Message content must not exceed 4000 characters' }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid conversation ID' }),
  }),
  body: sendMessageBodySchema,
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid conversation ID' }),
});

export const orgIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid organization ID' }),
});

export type CreateConversationDto = z.infer<typeof createConversationBodySchema>;
export type UpdateConversationDto = z.infer<typeof updateConversationBodySchema>;
export type SendMessageDto = z.infer<typeof sendMessageBodySchema>;
