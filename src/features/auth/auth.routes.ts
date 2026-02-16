import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/auth/login', {
    schema: {
      body: loginSchema,
    },
    handler: authController.login,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/register', {
    schema: {
      body: registerSchema,
    },
    handler: authController.register,
  });

  app.get('/auth/me', {
    onRequest: [app.authenticate],
    handler: authController.me,
  });
}
