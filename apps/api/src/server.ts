import { env } from './config/env.js';
import app from './app.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API Server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
});

export default server;
