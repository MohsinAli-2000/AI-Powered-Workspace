import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file into process.env
dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL is required' }),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Sentry
  SENTRY_DSN: z.string().optional(),

  // JWT & Authentication
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters long' }),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters long' }),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  // Object Storage (MinIO for development / AWS S3 for production)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  S3_BUCKET_NAME: z.string().default('ai-workspace-documents'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),
  MAX_FILE_SIZE_BYTES: z.coerce.number().default(52428800), // 50MB

  // Email Configuration (SMTP / Nodemailer & Resend)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('AI Workspace <no-reply@example.com>'),

  // AI & RAG Configuration (Phase 12 & Phase 14)
  AI_SERVICE_URL: z.string().default('http://localhost:8001'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  LLM_MODEL: z.string().default('qwen2.5'),
  RAG_SIMILARITY_THRESHOLD: z.coerce.number().default(0.35),
  RAG_TOP_K: z.coerce.number().default(5),
  AI_PROVIDER: z.enum(['ollama', 'mock', 'ai-service']).default('ollama'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
