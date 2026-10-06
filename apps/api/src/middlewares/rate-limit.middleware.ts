import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

interface RateLimitOptions {
  /** Length of the counting window. */
  windowMs: number;
  /** Maximum requests allowed per client within the window. */
  max: number;
  /** Shown to the client when the limit is hit. */
  message?: string;
}

/**
 * Minimal in-memory fixed-window rate limiter keyed by client IP.
 *
 * Meant for the credential endpoints (login, register, password reset): it blunts password guessing and
 * e-mail flooding without adding a dependency. State is per process, which is fine for a single API instance;
 * put a shared store (e.g. Redis) behind it before running several instances.
 */
export const rateLimit = (options: RateLimitOptions) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Drop expired windows now and then so the map cannot grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, options.windowMs);
  sweeper.unref();

  return (request: Request, response: Response, next: NextFunction): void => {
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        new AppError(
          options.message ?? 'Too many attempts. Please wait a few minutes and try again.',
          429
        )
      );
      return;
    }
    next();
  };
};
