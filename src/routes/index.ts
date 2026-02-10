import { FastifyInstance } from 'fastify';
import { userRoutes } from '../features/users/index.js';

export async function registerRoutes(app: FastifyInstance) {
  // Register user routes with /api/v1 prefix
  await app.register(userRoutes, { prefix: '/api/v1' });
}
