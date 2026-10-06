import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

const isPgError = (err: unknown): err is Error & { code: string } =>
  typeof (err as { code?: unknown } | null)?.code === 'string' &&
  /^[0-9A-Z]{5}$/.test((err as { code: string }).code);

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: unknown = undefined;

  // 1. Handled Operational Errors (AppError)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }
  // 2. Schema Validation Errors (Zod)
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = err.flatten().fieldErrors;
  }
  // 3. Syntax Errors (e.g. malformed JSON body)
  else if ('type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }
  // 4. Postgres errors that are the client's doing, not server faults
  else if (isPgError(err)) {
    const pgCode = err.code;
    if (pgCode === '23505') {
      statusCode = 409;
      message = 'This record already exists.';
    } else if (pgCode === '23503') {
      statusCode = 409;
      message = 'This action conflicts with related data (a referenced record is missing or still in use).';
    } else if (pgCode === '22P02' || pgCode === '22003') {
      statusCode = 400;
      message = 'One of the supplied values has an invalid format.';
    }
  }
  // 5. Framework/body-parser errors that carry their own 4xx status (413 payload too large, 415, ...)
  else {
    const httpStatus = (err as { status?: unknown; statusCode?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
    if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
      statusCode = httpStatus;
      message = httpStatus === 413 ? 'Request body is too large.' : err.message || 'Bad request';
    }
  }

  // Log error using structured Pino logger
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        req: {
          method: req.method,
          url: req.originalUrl,
          params: req.params,
          query: req.query,
        },
      },
      `Unhandled Server Error: ${err.message}`
    );
  } else {
    logger.warn(
      {
        statusCode,
        message,
        url: req.originalUrl,
        method: req.method,
        details,
      },
      `Operational Error: ${message}`
    );
  }

  // Construct standard client response
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  };

  res.status(statusCode).json(response);
};
