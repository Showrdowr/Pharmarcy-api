import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { dashboardService } from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.requireRole('admin', 'super_admin'));

  app.withTypeProvider<ZodTypeProvider>().get('/dashboard', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Get backoffice dashboard overview',
    },
    handler: async (_request, reply) => {
      const data = await dashboardService.getDashboardData();
      return reply.send({
        success: true,
        data,
      });
    },
  });
}
