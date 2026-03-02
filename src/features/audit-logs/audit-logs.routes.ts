import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { auditLogsController } from './audit-logs.controller.js';
import { listAuditLogsQuerySchema } from './audit-logs.schema.js';

export async function auditLogsRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  app.register(async (adminApp) => {
    // Require admin role for all audit logs routes
    adminApp.addHook('onRequest', app.requireRole('admin'));

    const typedAdminApp = adminApp.withTypeProvider<ZodTypeProvider>();

    typedAdminApp.get('/audit-logs', {
      schema: {
        tags: ['Admin - Audit Logs'],
        summary: 'List admin audit logs (Admin only)',
        querystring: listAuditLogsQuerySchema,
      },
      handler: auditLogsController.getLogs,
    });
  });
}

