import { FastifyInstance } from 'fastify';
import { userRoutes } from '../features/users/index.js';
import { authRoutes } from '../features/auth/index.js';
import { adminAuthRoutes, adminManageRoutes } from '../features/admin-auth/index.js';

export async function registerRoutes(app: FastifyInstance) {
  // Register user routes with /api/v1 prefix
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });

  // Admin/Backoffice routes
  await app.register(adminAuthRoutes, { prefix: '/api/v1' });
  await app.register(adminManageRoutes, { prefix: '/api/v1' });
}
