import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { userController } from './user.controller.js';
import { userService } from './user.service.js';
import { createUserSchema, updateUserSchema, userParamsSchema } from './user.schema.js';

export async function userRoutes(app: FastifyInstance) {
  // ป้องกันเส้นทาง Users ทั้งหมด — ให้เข้าถึงได้เฉพาะ Admin หรือ Super Admin เท่านั้น
  app.addHook('onRequest', app.requireRole('admin', 'super_admin'));

  app.withTypeProvider<ZodTypeProvider>().get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Get all users',
      querystring: z.object({
        role: z.enum(['member', 'pharmacist', 'admin']).optional(),
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20),
        search: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      }),
    },
    handler: async (request, reply) => {
      const { role, page, limit, search, status } = request.query as { role?: any; page: number; limit: number; search?: string; status?: 'active' | 'inactive' };
      const offset = (page - 1) * limit;
      const result = await userService.getAllUsers({ role, limit, offset, search, status });
      return reply.send({ data: result });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().get('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      params: userParamsSchema,
    },
    handler: userController.getById,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      body: createUserSchema,
    },
    handler: userController.create,
  });

  app.withTypeProvider<ZodTypeProvider>().put('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update a user',
      params: userParamsSchema,
      body: updateUserSchema,
    },
    handler: userController.update,
  });

  app.withTypeProvider<ZodTypeProvider>().delete('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete a user',
      params: userParamsSchema,
    },
    handler: userController.delete,
  });
}
