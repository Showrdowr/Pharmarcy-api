import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { userController } from './user.controller.js';
import { createUserSchema, updateUserSchema, userParamsSchema } from './user.schema.js';

export async function userRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Get all users',
    },
    handler: userController.getAll,
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
