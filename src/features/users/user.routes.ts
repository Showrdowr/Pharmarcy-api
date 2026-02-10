import { FastifyInstance } from 'fastify';
import { userController } from './user.controller.js';

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Get all users',
      response: { 200: { type: 'array' } },
    },
    handler: userController.getAll,
  });

  app.get('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
    handler: userController.getById,
  });

  app.post('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    },
    handler: userController.create,
  });

  app.put('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update a user',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
    handler: userController.update,
  });

  app.delete('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete a user',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
    handler: userController.delete,
  });
}
