process.env.DATABASE_URL ??= 'postgres://tester:tester@127.0.0.1:5432/pharmacy_academy_test';
process.env.JWT_SECRET ??= 'jwt-plugin-test-secret-value-123';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';

import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { registerJwt } from './jwt.js';

const appsToClose: Array<Awaited<ReturnType<typeof createTestApp>>> = [];

async function createTestApp() {
  const app = Fastify({ logger: false });
  await registerJwt(app);

  app.get('/system-admin-only', {
    onRequest: [app.requireRole('system_admin')],
    handler: async () => ({ ok: true }),
  });

  app.get('/admin-only', {
    onRequest: [app.requireRole('admin', 'super_admin')],
    handler: async () => ({ ok: true }),
  });

  await app.ready();
  return app;
}

describe('registerJwt requireRole', () => {
  afterEach(async () => {
    while (appsToClose.length > 0) {
      const app = appsToClose.pop();
      if (!app) {
        continue;
      }
      await app.close();
    }
  });

  it('allows a system_admin token when the route explicitly includes that role', async () => {
    const app = await createTestApp();
    appsToClose.push(app);
    const token = app.jwt.sign({ id: 'sys-1', role: 'system_admin', isAdmin: false });

    const response = await app.inject({
      method: 'GET',
      url: '/system-admin-only',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('still rejects roles that are not explicitly allowed', async () => {
    const app = await createTestApp();
    appsToClose.push(app);
    const token = app.jwt.sign({ id: 'officer-1', role: 'officer', isAdmin: false });

    const response = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('FORBIDDEN');
  });
});
