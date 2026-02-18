import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { adminAuthController } from './admin-auth.controller.js';
import { adminLoginSchema } from './admin-auth.schema.js';

export async function adminAuthRoutes(app: FastifyInstance) {
  // Admin Login
  app.withTypeProvider<ZodTypeProvider>().post('/admin/auth/login', {
    schema: {
      tags: ['Admin Auth'],
      summary: 'Admin/Officer login',
      body: adminLoginSchema,
    },
    handler: adminAuthController.login,
  });

  // Get current admin user info
  app.get('/admin/auth/me', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Admin Auth'],
      summary: 'Get current admin user info',
    },
    handler: adminAuthController.me,
  });
}
