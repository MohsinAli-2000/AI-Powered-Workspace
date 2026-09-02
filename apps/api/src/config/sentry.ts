import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const initSentry = (): void => {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry DSN not provided — skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
    sendDefaultPii: false,
    beforeSend(event, hint) {
      // Don't report operational 4xx errors to Sentry
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode < 500) {
          return null; // drop event from Sentry
        }
      }
      return event;
    },
  });

  logger.info(`Sentry error monitoring initialized for [${env.NODE_ENV}] environment`);
};

export { Sentry };
