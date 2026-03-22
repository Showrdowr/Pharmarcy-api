process.env.DATABASE_URL ??= 'postgres://tester:tester@127.0.0.1:5432/pharmacy_academy_test';
process.env.JWT_SECRET ??= 'users-route-test-secret-value-123';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const serviceMocks = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  getUserOverview: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('./user.service.js', () => ({
  userService: serviceMocks,
}));

import { errorHandler } from '../../plugins/error-handler.js';
import { registerJwt } from '../../plugins/jwt.js';
import { userRoutes } from './user.routes.js';

async function createTestApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerJwt(app);
  app.setErrorHandler(errorHandler);
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.ready();

  return app;
}

describe('user routes', () => {
  beforeEach(() => {
    serviceMocks.getAllUsers.mockReset();
    serviceMocks.getUserById.mockReset();
    serviceMocks.getUserOverview.mockReset();
    serviceMocks.createUser.mockReset();
    serviceMocks.updateUser.mockReset();
    serviceMocks.deleteUser.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin access to list users', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns overview payload for admin tokens', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 'admin-1', role: 'admin', isAdmin: true });

    serviceMocks.getUserOverview.mockResolvedValue({
      profile: {
        id: '7',
        fullName: 'ผู้ใช้ตัวอย่าง',
        email: 'user@example.com',
        role: 'member',
        professionalLicenseNumber: null,
        createdAt: '2026-03-10T00:00:00.000Z',
        accountStatus: 'active',
        failedAttempts: 0,
      },
      summary: {
        totalCourses: 2,
        completedCourses: 1,
        inProgressCourses: 1,
        averageWatchPercent: 75,
        totalSpent: 1500,
        earnedCpeCredits: 0,
      },
      enrollments: [],
      transactions: [],
      certificates: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/7/overview',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getUserOverview).toHaveBeenCalledWith(7);
    expect(response.json().data.profile.email).toBe('user@example.com');

    await app.close();
  });
});
