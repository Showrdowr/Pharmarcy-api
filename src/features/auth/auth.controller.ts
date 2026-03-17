import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { authService } from './auth.service.js';
import { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, UpdateProfileInput, ChangePasswordInput } from './auth.schema.js';
import type { z } from 'zod';
import type { verifyOtpSchema } from './auth.schema.js';
type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
import { userRepository } from '../users/user.repository.js';
import { sendOtpEmail } from '../../services/email.service.js';
import { captchaUtil } from '../common/captcha.js';

export const authController = {
  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
  ) {
    const { email, password, captchaAnswer, captchaToken } = request.body;

    // 1. Find user first to check failed attempts
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'เข้าสู่ระบบล้มเหลว',
        field: 'email'
      });
    }

    // 2. CAPTCHA is now ALWAYS required
    const requiresCaptcha = true;

    if (requiresCaptcha) {
      if (!captchaAnswer || !captchaToken) {
        return reply.status(401).send({
          success: false,
          error: 'กรุณากรอกรหัส CAPTCHA',
          requiresCaptcha: true
        });
      }

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
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Increment failed attempts
      await userRepository.incrementFailedAttempts(user.id);
      
      const newFailedAttempts = (user.failedAttempts || 0) + 1;
      return reply.status(401).send({
        success: false,
        error: 'เข้าสู่ระบบล้มเหลว',
        field: 'password',
        requiresCaptcha: newFailedAttempts >= 3
      });
    }

    // 4. Success - Reset failed attempts
    if ((user.failedAttempts || 0) > 0) {
      await userRepository.resetFailedAttempts(user.id);
    }

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

  async getCaptcha(request: FastifyRequest, reply: FastifyReply) {
    const { svg, token } = captchaUtil.generate();
    return reply.send({
      success: true,
      svg,
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

  async logout(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return reply.send({ success: true, message: 'ออกจากระบบสำเร็จ' });
  },

  async updateProfile(
    request: FastifyRequest<{ Body: UpdateProfileInput }>,
    reply: FastifyReply
  ) {
    const userPayload = request.user as { id: number };
    const user = await userRepository.findById(userPayload.id);

    if (!user) {
      return reply.status(404).send({ success: false, error: 'ไม่พบผู้ใช้' });
    }

    const updateData: Record<string, string | undefined> = {};
    if (request.body.fullName !== undefined) updateData.fullName = request.body.fullName;
    if (request.body.professionalLicenseNumber !== undefined) updateData.professionalLicenseNumber = request.body.professionalLicenseNumber;

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ success: false, error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' });
    }

    const updated = await userRepository.update(userPayload.id, updateData);

    return reply.send({
      success: true,
      user: {
        id: updated!.id,
        fullName: updated!.fullName,
        email: updated!.email,
        role: updated!.role,
        professionalLicenseNumber: updated!.professionalLicenseNumber,
      },
    });
  },

  async changePassword(
    request: FastifyRequest<{ Body: ChangePasswordInput }>,
    reply: FastifyReply
  ) {
    const userPayload = request.user as { id: number };
    const user = await userRepository.findById(userPayload.id);

    if (!user) {
      return reply.status(404).send({ success: false, error: 'ไม่พบผู้ใช้' });
    }

    const isValid = await bcrypt.compare(request.body.oldPassword, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({ success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const newHash = await bcrypt.hash(request.body.newPassword, 10);
    await userRepository.update(userPayload.id, { passwordHash: newHash });

    return reply.send({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  },

  async forgotPassword(
    request: FastifyRequest<{ Body: ForgotPasswordInput }>,
    reply: FastifyReply
  ) {
    const { email } = request.body;
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'ไม่พบอีเมลนี้ในระบบ',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to DB
    await userRepository.updateResetOtp(email, otp, expiresAt);

    // Send OTP email
    try {
      await sendOtpEmail(email, otp);
    } catch (err) {
      request.log.error(err, 'Failed to send OTP email');
      return reply.status(500).send({
        success: false,
        error: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่',
      });
    }

    return reply.send({
      success: true,
      message: 'ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว',
    });
  },

  async verifyOtp(
    request: FastifyRequest<{ Body: VerifyOtpInput }>,
    reply: FastifyReply
  ) {
    const { email, otp } = request.body;
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return reply.status(404).send({ success: false, error: 'ไม่พบอีเมลนี้ในระบบ' });
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      return reply.status(400).send({ success: false, error: 'รหัส OTP ไม่ถูกต้อง' });
    }

    if (!user.resetOtpExpiresAt || new Date() > user.resetOtpExpiresAt) {
      return reply.status(400).send({ success: false, error: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่' });
    }

    return reply.send({ success: true, message: 'ยืนยัน OTP สำเร็จ' });
  },

  async resetPassword(
    request: FastifyRequest<{ Body: ResetPasswordInput }>,
    reply: FastifyReply
  ) {
    const { email, otp, captchaAnswer, captchaToken, newPassword } = request.body;
    const user = await userRepository.findByEmail(email);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'ไม่พบอีเมลนี้ในระบบ',
      });
    }

    // CAPTCHA Validation Flow
    if (!captchaAnswer || !captchaToken) {
      return reply.status(400).send({
        success: false,
        error: 'กรุณากรอกรหัส CAPTCHA',
      });
    }

    const isCaptchaValid = captchaUtil.verify(captchaAnswer, captchaToken);
    if (!isCaptchaValid) {
      return reply.status(400).send({
        success: false,
        error: 'รหัส CAPTCHA ไม่ถูกต้อง',
      });
    }

    // OTP Validation Flow (Hidden/Commented out)
    /*
    if (!user.resetOtp || user.resetOtp !== otp) {
      return reply.status(400).send({
        success: false,
        error: 'รหัส OTP ไม่ถูกต้อง',
      });
    }

    // Check expiry
    if (!user.resetOtpExpiresAt || new Date() > user.resetOtpExpiresAt) {
      return reply.status(400).send({
        success: false,
        error: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่',
      });
    }
    */

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user.id, { passwordHash });

    // Clear OTP
    await userRepository.clearResetOtp(email);

    return reply.send({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    });
  },
};
