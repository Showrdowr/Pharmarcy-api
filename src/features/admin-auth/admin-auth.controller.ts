import { FastifyRequest, FastifyReply } from 'fastify';
import { adminAuthService } from './admin-auth.service.js';
import { adminAuthRepository } from './admin-auth.repository.js';
import { AdminLoginInput, AdminTokenPayload } from './admin-auth.schema.js';
import { captchaUtil } from '../common/captcha.js';
import bcrypt from 'bcrypt';

export const adminAuthController = {
  async login(
    request: FastifyRequest<{ Body: AdminLoginInput }>,
    reply: FastifyReply
  ) {
    console.log('DEBUG: Hit AdminAuthController.login');
    try {
      const { email, password, captchaAnswer, captchaToken } = request.body;

      // 1. Find user first to check failed attempts
      const admin = await adminAuthRepository.findByEmail(email);
      if (!admin) {
        return reply.status(401).send({
          success: false,
          error: 'ไม่พบอีเมลนี้ในระบบ',
          field: 'email'
        });
      }

      // 2. CAPTCHA is now ALWAYS required
      const requiresCaptcha = true;

      if (requiresCaptcha) {
        // If required but not provided
        if (!captchaAnswer || !captchaToken) {
          return reply.status(401).send({
            success: false,
            error: 'กรุณากรอกรหัส CAPTCHA',
            requiresCaptcha: true
          });
        }

        // Verify captcha
        const isCaptchaValid = captchaUtil.verify(captchaAnswer, captchaToken);
        if (!isCaptchaValid) {
          return reply.status(401).send({
            success: false,
            error: 'รหัส CAPTCHA ไม่ถูกต้อง',
            requiresCaptcha: true
          });
        }
      }

      // 3. Verify password
      const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
      if (!isPasswordValid) {
        // Increment failed attempts
        await adminAuthRepository.incrementFailedAttempts(admin.id);
        
        const newFailedAttempts = admin.failedAttempts + 1;
        return reply.status(401).send({
          success: false,
          error: 'รหัสผ่านไม่ถูกต้อง',
          field: 'password',
          requiresCaptcha: newFailedAttempts >= 3
        });
      }

      // 4. Success - Reset failed attempts
      if (admin.failedAttempts > 0) {
        await adminAuthRepository.resetFailedAttempts(admin.id);
      }

      const token = request.server.jwt.sign({
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        isAdmin: true,
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
    } catch (err) {
      const error = err as Error & { statusCode?: number; field?: string };
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        success: false,
        error: error.message,
        field: error.field || null,
      });
    }
  },

  async getCaptcha(request: FastifyRequest, reply: FastifyReply) {
    const { svg, token } = captchaUtil.generate();
    return reply.send({
      success: true,
      svg,
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
