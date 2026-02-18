import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';

export async function registerJwt(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // Decorator สำหรับ authenticate (verify JWT token)
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });

  // Decorator สำหรับ requireRole — ตรวจ role ของ admin user
  app.decorate('requireRole', function (...allowedRoles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
        const user = request.user as { role?: string; isAdmin?: boolean };

        if (!user.isAdmin) {
          return reply.status(403).send({ success: false, error: 'Forbidden: admin access required' });
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role || '')) {
          return reply.status(403).send({ success: false, error: `Forbidden: requires role ${allowedRoles.join(' or ')}` });
        }
      } catch (err) {
        reply.status(401).send({ success: false, error: 'Unauthorized' });
      }
    };
  });
}

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
