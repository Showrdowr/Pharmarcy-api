import { FastifyInstance } from 'fastify';
import { dashboardController } from './dashboard.controller.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', app.requireRole('admin', 'super_admin'));

    adminApp.get('/dashboard', {
      schema: {
        tags: ['Admin - Dashboard'],
        summary: 'Get dashboard stats (Admin only)',
      },
      handler: dashboardController.getDashboard,
    });
  });
}
