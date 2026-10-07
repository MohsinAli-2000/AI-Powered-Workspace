import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { BadRequestError } from '../errors/app-error.js';
import { isSupportedDocumentFile } from '../modules/documents/document.schema.js';

const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  // multer decodes multipart filenames as latin1 by default, which mangles non-ASCII names.
  defParamCharset: 'utf8',
  limits: {
    fileSize: env.MAX_FILE_SIZE_BYTES,
  },
}).single('file');

/**
 * Middleware that handles multipart/form-data document file upload,
 * enforces file size limits, non-empty content, and supported file extensions/MIME types.
 */
export const handleDocumentUpload = (
  incomingRequest: Request,
  outgoingResponse: Response,
  nextMiddleware: NextFunction
): void => {
  multerUpload(incomingRequest, outgoingResponse, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return nextMiddleware(
            new BadRequestError(
              `File size exceeds maximum allowed limit of ${Math.round(env.MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`
            )
          );
        }
        return nextMiddleware(new BadRequestError(`File upload error: ${err.message}`));
      }
      return nextMiddleware(err);
    }

    const uploadedFile = incomingRequest.file;

    if (!uploadedFile) {
      return nextMiddleware(new BadRequestError('No document file was uploaded.'));
    }

    if (uploadedFile.size === 0 || uploadedFile.buffer.length === 0) {
      return nextMiddleware(new BadRequestError('Uploaded file is empty (0 bytes).'));
    }

    // Validate supported file format (PDF, DOCX, XLSX, TXT, PPTX, PNG, JPG, WEBP)
    if (!isSupportedDocumentFile(uploadedFile.originalname, uploadedFile.mimetype)) {
      return nextMiddleware(
        new BadRequestError(
          'Unsupported file format. The system accepts: PDF, DOCX, XLSX, TXT, PPTX, and Images (PNG, JPG, WEBP).'
        )
      );
    }

    nextMiddleware();
  });
};
