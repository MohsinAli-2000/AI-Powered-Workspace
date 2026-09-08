import { z } from 'zod';
import path from 'path';

/**
 * MIME types and file extensions supported by the system in the MVP (FR-DOC-002).
 */
export const SUPPORTED_FILE_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const SUPPORTED_MIME_TYPES = new Set(Object.values(SUPPORTED_FILE_EXTENSIONS));

/**
 * Validates whether a file is supported based on both its extension and MIME type.
 */
export const isSupportedDocumentFile = (
  originalFilename: string,
  mimeType: string
): boolean => {
  const ext = path.extname(originalFilename).toLowerCase();
  const expectedMime = SUPPORTED_FILE_EXTENSIONS[ext];

  if (!expectedMime) {
    return false;
  }

  // Accept if expected MIME type matches or standard text/plain or binary octet-stream for valid extensions
  return (
    mimeType === expectedMime ||
    mimeType === 'application/octet-stream' ||
    (ext === '.txt' && mimeType.startsWith('text/'))
  );
};

/**
 * Schema for uploading a document to a project.
 */
export const uploadDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, { message: 'Document name cannot be empty' })
      .max(255, { message: 'Document name cannot exceed 255 characters' })
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, { message: 'Description cannot exceed 1000 characters' })
      .optional()
      .nullable(),
    access_mode: z
      .enum(['PROJECT', 'RESTRICTED'], {
        error: 'Access mode must be either PROJECT or RESTRICTED',
      })
      .optional(),
  }),
});

/**
 * Schema for listing documents within a project.
 */
export const listProjectDocumentsSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid project identifier format' }),
  }),
});

/**
 * Schema for routes with a single document UUID parameter.
 */
export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid document identifier format' }),
  }),
});

/**
 * Schema for updating document metadata.
 */
export const updateDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid document identifier format' }),
  }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, { message: 'Document name cannot be empty' })
        .max(255, { message: 'Document name cannot exceed 255 characters' })
        .optional(),
      description: z
        .string()
        .trim()
        .max(1000, { message: 'Description cannot exceed 1000 characters' })
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

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
