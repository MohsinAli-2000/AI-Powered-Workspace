import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { checkDbHealth } from '../../db/pool.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();

  const isHealthy = dbHealth.isHealthy;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Number(process.uptime().toFixed(2)),
    environment: env.NODE_ENV,
    checks: {
      database: {
        status: dbHealth.isHealthy ? 'up' : 'down',
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
    },
  });
});

export const healthRouter = router;
