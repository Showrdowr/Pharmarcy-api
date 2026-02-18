import { FastifyRequest, FastifyReply } from 'fastify';
import { adminAuthService } from './admin-auth.service.js';
import { adminAuthRepository } from './admin-auth.repository.js';
import { AdminLoginInput, AdminTokenPayload } from './admin-auth.schema.js';

export const adminAuthController = {
  async login(
    request: FastifyRequest<{ Body: AdminLoginInput }>,
    reply: FastifyReply
  ) {
    const admin = await adminAuthService.login(request.body);

    const token = request.server.jwt.sign({
      id: admin.id,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      isAdmin: true,  // flag to distinguish from web_frontend tokens
    });

    return reply.send({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      token,
    });
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.user as AdminTokenPayload;
    const admin = await adminAuthRepository.findById(payload.id);

    if (!admin) {
      return reply.status(404).send({ success: false, error: 'Admin user not found' });
    }

    return reply.send({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  },
};
