process.env.DATABASE_URL ??= 'postgres://tester:tester@127.0.0.1:5432/pharmacy_academy_test';
process.env.JWT_SECRET ??= 'dashboard-route-test-secret-value-123';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const serviceMocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

vi.mock('./dashboard.service.js', () => ({
  dashboardService: serviceMocks,
}));

import { errorHandler } from '../../plugins/error-handler.js';
import { registerJwt } from '../../plugins/jwt.js';
import { dashboardRoutes } from './dashboard.routes.js';

async function createTestApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerJwt(app);
  app.setErrorHandler(errorHandler);
  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.ready();

  return app;
}

describe('dashboard routes', () => {
  beforeEach(() => {
    serviceMocks.getDashboardData.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-admin tokens', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns dashboard data for admin tokens', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 'admin-1', role: 'admin', isAdmin: true });

    serviceMocks.getDashboardData.mockResolvedValue({
      stats: {
        totalUsers: 12,
        totalCourses: 5,
        monthlyRevenue: 12000,
        cpeCreditsIssued: 30,
        usersChange: 10,
        coursesChange: 5,
        revenueChange: 20,
        cpeCreditsChange: 15,
      },
      weeklyRevenue: [
        { date: '2026-03-20T00:00:00.000Z', label: 'ศ.', amount: 1000 },
      ],
      recentEnrollments: [
        { id: '1', userName: 'ผู้ใช้ตัวอย่าง', courseName: 'คอร์สตัวอย่าง', enrolledAt: '2026-03-20T00:00:00.000Z' },
      ],
      topCourses: [
        { id: '1', name: 'คอร์สตัวอย่าง', title: 'คอร์สตัวอย่าง', enrollments: 20, revenue: 15000 },
      ],
      systemStatus: {
        api: { status: 'healthy', label: 'ปกติ' },
        database: { status: 'healthy', label: 'ปกติ' },
        videoProvider: { status: 'healthy', label: 'พร้อมใช้งาน' },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getDashboardData).toHaveBeenCalledTimes(1);
    expect(response.json().data.stats.totalUsers).toBe(12);

    await app.close();
  });
});
