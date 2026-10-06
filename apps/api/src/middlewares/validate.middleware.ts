import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';

/**
 * Middleware factory that validates incoming HTTP requests against a Zod schema.
 *
 * @param validationSchema - The Zod schema defining the expected shape of body, query, and params.
 */
export const validateRequest = (validationSchema: ZodType) => {
  return async (
    request: Request,
    _response: Response,
    nextMiddleware: NextFunction
  ): Promise<void> => {
    try {
      const parsedRequestData = (await validationSchema.parseAsync({
        body: request.body,
        query: request.query,
        params: request.params,
      })) as {
        body?: unknown;
        query?: Request['query'];
        params?: Request['params'];
      };

      // Assign sanitized and coerced data back to the request
      if (parsedRequestData.body !== undefined) {
        request.body = parsedRequestData.body;
      }
      if (parsedRequestData.query !== undefined) {
        // Express 5 exposes `req.query` as a getter-only property, so plain assignment throws a TypeError
        // (this made every query-validated route, e.g. the audit log list, fail with a 500).
        Object.defineProperty(request, 'query', {
          value: parsedRequestData.query,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (parsedRequestData.params !== undefined) {
        request.params = parsedRequestData.params;
      }

      nextMiddleware();
    } catch (validationError) {
      // Forward the ZodError directly to our centralized error handler
      nextMiddleware(validationError);
    }
  };
};
