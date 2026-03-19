import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { dashboardController } from './dashboard.controller.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // Ensure only authorized admins can access backoffice dashboard
  app.addHook('onRequest', app.requireRole('admin', 'super_admin', 'system_admin'));

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get('/dashboard', {
    schema: {
      tags: ['Admin - Dashboard'],
      summary: 'Get dashboard statistics, top courses, and recent enrollments',
    },
    handler: dashboardController.getDashboardData,
  });
}
