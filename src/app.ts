import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerSwagger } from './plugins/swagger.js';
import { errorHandler } from './plugins/error-handler.js';
import { registerJwt } from './plugins/jwt.js';
import { registerRoutes } from './routes/index.js';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';

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

  // Log incoming requests
  app.addHook('onRequest', async (request) => {
    request.log.info({ url: request.url, method: request.method }, 'Incoming request');
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register plugins
  await app.register(cors, { origin: true });
  await registerSwagger(app);
  await registerJwt(app);

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
