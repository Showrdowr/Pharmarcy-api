import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { adminManageController } from './admin-manage.controller.js';
import { createOfficerSchema, adminUserParamsSchema, deleteAdminBodySchema } from './admin-manage.schema.js';

export async function adminManageRoutes(app: FastifyInstance) {
  // ทุก route ต้องเป็น admin (รองรับทั้ง 'admin' และ 'super_admin')
  app.addHook('onRequest', app.requireRole('admin', 'super_admin'));

  // Create officer account
  app.withTypeProvider<ZodTypeProvider>().post('/admin/users', {
    schema: {
      tags: ['Admin Management'],
      summary: 'Create officer account (admin only)',
      body: createOfficerSchema,
    },
    handler: adminManageController.createOfficer,
  });
  
  // List all roles
  app.withTypeProvider<ZodTypeProvider>().get('/admin/roles', {
    schema: {
      tags: ['Admin Management'],
      summary: 'List all available roles',
    },
    handler: adminManageController.listRoles,
  });

  // List all admin/officer users
  app.withTypeProvider<ZodTypeProvider>().get('/admin/users', {
    schema: {
      tags: ['Admin Management'],
      summary: 'List all admin/officer users',
    },
    handler: adminManageController.listAdminUsers,
  });

  // Delete admin/officer user (requires password confirmation in body)
  app.withTypeProvider<ZodTypeProvider>().delete('/admin/users/:id', {
    schema: {
      tags: ['Admin Management'],
      summary: 'Delete admin/officer user (admin only, password required)',
      params: adminUserParamsSchema,
      body: deleteAdminBodySchema,
    },
    handler: adminManageController.deleteAdminUser,
  });
}
