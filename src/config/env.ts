import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  VIMEO_ACCESS_TOKEN: z.string().min(1).optional(),
  VIMEO_ALLOWED_EMBED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
