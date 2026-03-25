process.env.DATABASE_URL ??= 'postgres://tester:tester@127.0.0.1:5432/pharmacy_academy_test';
process.env.JWT_SECRET ??= 'public-route-test-secret-value-123';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const serviceMocks = vi.hoisted(() => ({
  listPublishedCourses: vi.fn(),
  getPublishedCourse: vi.fn(),
}));

vi.mock('./courses.service.js', () => ({
  coursesService: serviceMocks,
}));

import { errorHandler } from '../../plugins/error-handler.js';
import { registerJwt } from '../../plugins/jwt.js';
import { coursesRoutes } from './courses.routes.js';

async function createTestApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerJwt(app);
  app.setErrorHandler(errorHandler);
  await app.register(coursesRoutes, { prefix: '/api/v1' });
  await app.ready();

  return app;
}

describe('public course routes', () => {
  beforeEach(() => {
    serviceMocks.listPublishedCourses.mockReset();
    serviceMocks.getPublishedCourse.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('treats public course list requests without auth as guest visibility', async () => {
    const app = await createTestApp();
    serviceMocks.listPublishedCourses.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/public/courses?search=tele&limit=12',
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.listPublishedCourses).toHaveBeenCalledWith(
      { categoryId: undefined, search: 'tele', limit: 12 },
      undefined,
    );

    await app.close();
  });

  it('passes authenticated learner context to public course detail visibility checks', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'member' });
    serviceMocks.getPublishedCourse.mockResolvedValue({
      id: 12,
      title: 'คอร์สตัวอย่าง',
      audience: 'all',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/public/courses/12',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getPublishedCourse).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ id: 99, role: 'member' }),
    );

    await app.close();
  });

  it('returns role-forbidden responses from the public detail policy', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'member' });
    serviceMocks.getPublishedCourse.mockRejectedValue(
      Object.assign(new Error('คุณไม่มีสิทธิ์เข้าถึงคอร์สนี้'), {
        statusCode: 403,
        code: 'COURSE_ROLE_FORBIDDEN',
      }),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/public/courses/12',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      statusCode: 403,
      code: 'COURSE_ROLE_FORBIDDEN',
      message: 'คุณไม่มีสิทธิ์เข้าถึงคอร์สนี้',
    });

    await app.close();
  });
});
