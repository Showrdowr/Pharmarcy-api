import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { adminManageController } from './admin-manage.controller.js';
import { createOfficerSchema, adminUserParamsSchema } from './admin-manage.schema.js';

export async function adminManageRoutes(app: FastifyInstance) {
  // ทุก route ต้องเป็น admin เท่านั้น
  app.addHook('onRequest', app.requireRole('admin'));

  // Create officer account
  app.withTypeProvider<ZodTypeProvider>().post('/admin/users', {
    schema: {
      tags: ['Admin Management'],
      summary: 'Create officer account (admin only)',
      body: createOfficerSchema,
    },
    handler: adminManageController.createOfficer,
  });

  // List all admin/officer users
  app.withTypeProvider<ZodTypeProvider>().get('/admin/users', {
    schema: {
      tags: ['Admin Management'],
      summary: 'List all admin/officer users',
    },
    handler: adminManageController.listAdminUsers,
  });

  // Delete admin/officer user
  app.withTypeProvider<ZodTypeProvider>().delete('/admin/users/:id', {
    schema: {
      tags: ['Admin Management'],
      summary: 'Delete admin/officer user (admin only)',
      params: adminUserParamsSchema,
    },
    handler: adminManageController.deleteAdminUser,
  });
}
