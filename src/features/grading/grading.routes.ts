import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { gradingController } from './grading.controller.js';
import {
  gradingQuerySchema,
  attemptParamsSchema,
  submitGradesBodySchema,
} from './grading.schema.js';

export async function gradingRoutes(app: FastifyInstance) {
  const requireAdmin = app.requireRole('admin', 'super_admin');

  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', requireAdmin);
    const typedApp = adminApp.withTypeProvider<ZodTypeProvider>();

    // Get pending exam attempts
    typedApp.get('/admin/exam-attempts/pending', {
      schema: {
        tags: ['Admin - Grading'],
        summary: 'Get pending exam attempts for grading (Admin only)',
        querystring: gradingQuerySchema,
      },
      handler: gradingController.getPendingAttempts,
    });

    // Get grading detail for a specific attempt
    typedApp.get('/admin/exam-attempts/:attemptId', {
      schema: {
        tags: ['Admin - Grading'],
        summary: 'Get grading detail for an attempt (Admin only)',
        params: attemptParamsSchema,
      },
      handler: gradingController.getGradingDetail,
    });

    // Submit grades for an attempt
    typedApp.post('/admin/exam-attempts/:attemptId/grade', {
      schema: {
        tags: ['Admin - Grading'],
        summary: 'Submit grades for an attempt (Admin only)',
        params: attemptParamsSchema,
        body: submitGradesBodySchema,
      },
      handler: gradingController.submitGrades,
    });
  });
}
