import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { LoginInput, RegisterInput } from './auth.schema.js';
import { userRepository } from '../users/user.repository.js';

export const authController = {
  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
  ) {
    const user = await authService.login(request.body);

    const token = request.server.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return reply.send({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        professionalLicenseNumber: user.professionalLicenseNumber,
      },
      token,
    });
  },

  async register(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply
  ) {
    request.log.info({ body: request.body }, 'Register request received');
    try {
      const user = await authService.register(request.body);
      request.log.info({ userId: user.id }, 'User registered successfully');

      const token = request.server.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.send({
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          professionalLicenseNumber: user.professionalLicenseNumber,
        },
        token,
      });
    } catch (error) {
      request.log.error(error, 'Registration failed');
      throw error;
    }
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const userPayload = request.user as { id: number };
    const user = await userRepository.findById(userPayload.id);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        professionalLicenseNumber: user.professionalLicenseNumber,
      },
    });
  },
};
