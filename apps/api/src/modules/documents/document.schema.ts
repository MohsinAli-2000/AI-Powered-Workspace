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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.gif': 'image/gif',
};

export const SUPPORTED_MIME_TYPES = new Set([
  ...Object.values(SUPPORTED_FILE_EXTENSIONS),
  'image/jpg',
  'image/pjpeg',
  'image/x-png',
]);

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

  const cleanMime = (mimeType || '').split(';')[0].trim().toLowerCase();

  // Accept if expected MIME type matches, or octet-stream fallback, or image/text prefixes
  return (
    cleanMime === expectedMime ||
    cleanMime === 'application/octet-stream' ||
    (ext === '.txt' && cleanMime.startsWith('text/')) ||
    ((ext === '.jpg' || ext === '.jpeg') &&
      (cleanMime === 'image/jpeg' || cleanMime === 'image/jpg' || cleanMime === 'image/pjpeg')) ||
    (ext === '.png' && (cleanMime === 'image/png' || cleanMime === 'image/x-png')) ||
    (ext === '.webp' && cleanMime === 'image/webp') ||
    cleanMime.startsWith('image/')
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
      access_mode: z
        .enum(['PROJECT', 'RESTRICTED'], {
          error: 'Access mode must be either PROJECT or RESTRICTED',
        })
        .optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.description !== undefined ||
        data.access_mode !== undefined,
      {
        message: 'At least one field (name, description, or access_mode) must be provided to update',
      }
    ),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>['body'];
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>['body'];
