import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authController } from './auth.controller.js';
import { loginSchema, registerSchema, forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema, updateProfileSchema, changePasswordSchema } from './auth.schema.js';

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/auth/login', {
    schema: {
      body: loginSchema,
    },
    handler: authController.login,
  });

  app.get('/auth/captcha', {
    handler: authController.getCaptcha,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/register', {
    schema: {
      body: registerSchema,
    },
    handler: authController.register,
  });

  app.get('/auth/me', {
    onRequest: [app.authenticate],
    handler: authController.me,
  });

  app.post('/auth/logout', {
    handler: authController.logout,
  });

  app.withTypeProvider<ZodTypeProvider>().put('/auth/profile', {
    onRequest: [app.authenticate],
    schema: {
      body: updateProfileSchema,
    },
    handler: authController.updateProfile,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/change-password', {
    onRequest: [app.authenticate],
    schema: {
      body: changePasswordSchema,
    },
    handler: authController.changePassword,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/forgot-password', {
    schema: {
      body: forgotPasswordSchema,
    },
    handler: authController.forgotPassword,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/verify-otp', {
    schema: {
      body: verifyOtpSchema,
    },
    handler: authController.verifyOtp,
  });

  app.withTypeProvider<ZodTypeProvider>().post('/auth/reset-password', {
    schema: {
      body: resetPasswordSchema,
    },
    handler: authController.resetPassword,
  });
}
