import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { cpeCreditsController } from './cpe-credits.controller.js';
import { cpeQuerySchema } from './cpe-credits.schema.js';

export async function cpeCreditsRoutes(app: FastifyInstance) {
  const requireAdmin = app.requireRole('admin', 'super_admin');

  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', requireAdmin);
    const typedApp = adminApp.withTypeProvider<ZodTypeProvider>();

    // Get CPE credit records
    typedApp.get('/admin/cpe-credits', {
      schema: {
        tags: ['Admin - CPE Credits'],
        summary: 'Get CPE credit records (Admin only)',
        querystring: cpeQuerySchema,
      },
      handler: cpeCreditsController.getRecords,
    });

    // Get CPE stats
    typedApp.get('/admin/cpe-credits/stats', {
      schema: {
        tags: ['Admin - CPE Credits'],
        summary: 'Get CPE credit stats (Admin only)',
      },
      handler: cpeCreditsController.getStats,
    });
  });
}
