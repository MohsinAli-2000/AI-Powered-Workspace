import { initSentry } from './config/sentry.js';
import { env } from './config/env.js';
import app from './app.js';

// Initialize Sentry monitoring before loading the application
initSentry();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API Server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
});

export default server;
