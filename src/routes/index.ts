import { FastifyInstance } from 'fastify';
import { userRoutes } from '../features/users/index.js';
import { authRoutes } from '../features/auth/index.js';
import { adminAuthRoutes, adminManageRoutes } from '../features/admin-auth/index.js';
import { coursesRoutes } from '../features/courses/index.js';
import { auditLogsRoutes } from '../features/audit-logs/index.js';
import { adminLoginLogsRoutes } from '../features/admin-login-logs/admin-login-logs.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  // Register user routes with /api/v1 prefix
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(coursesRoutes, { prefix: '/api/v1' });
  await app.register(auditLogsRoutes, { prefix: '/api/v1' });
  await app.register(adminLoginLogsRoutes, { prefix: '/api/v1/admin-login-logs' });

  // Admin/Backoffice routes
  await app.register(adminAuthRoutes, { prefix: '/api/v1' });
  await app.register(adminManageRoutes, { prefix: '/api/v1' });
}
