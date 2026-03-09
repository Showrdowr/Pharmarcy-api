import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { adminLoginLogsController } from './admin-login-logs.controller.js';
import { listLoginLogsQuerySchema } from './admin-login-logs.schema.js';

export async function adminLoginLogsRoutes(app: FastifyInstance) {
  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', app.requireRole('admin'));

    const typedAdminApp = adminApp.withTypeProvider<ZodTypeProvider>();

    typedAdminApp.get('/', {
      schema: {
        querystring: listLoginLogsQuerySchema
      }
    }, adminLoginLogsController.getLogs);
  });
}
