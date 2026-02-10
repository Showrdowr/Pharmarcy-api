import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerSwagger } from './plugins/swagger.js';
import { errorHandler } from './plugins/error-handler.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await registerSwagger(app);

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Register API routes
  await registerRoutes(app);

  return app;
}
