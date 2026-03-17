import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { examsController } from './exams.controller.js';
import {
  createExamSchema,
  updateExamSchema,
  createExamQuestionSchema,
  updateExamQuestionSchema,
  examParamsSchema,
  examQuestionParamsSchema,
  courseExamParamsSchema,
} from './exams.schema.js';

export async function examsRoutes(app: FastifyInstance) {
  const requireAdmin = app.requireRole('admin', 'super_admin');

  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', requireAdmin);
    const typedApp = adminApp.withTypeProvider<ZodTypeProvider>();

    // Get exam for a course
    typedApp.get('/courses/:id/exam', {
      schema: {
        tags: ['Admin - Exams'],
        summary: 'Get exam for a course (Admin only)',
        params: courseExamParamsSchema,
      },
      handler: examsController.getExamByCourse,
    });

    // Create exam for a course
    typedApp.post('/courses/:id/exam', {
      schema: {
        tags: ['Admin - Exams'],
        summary: 'Create exam for a course (Admin only)',
        params: courseExamParamsSchema,
        body: createExamSchema,
      },
      handler: examsController.createExam,
    });

    // Update exam
    typedApp.put('/exams/:id', {
      schema: {
        tags: ['Admin - Exams'],
        summary: 'Update an exam (Admin only)',
        params: examParamsSchema,
        body: updateExamSchema,
      },
      handler: examsController.updateExam,
    });

    // Delete exam
    typedApp.delete('/exams/:id', {
      schema: {
        tags: ['Admin - Exams'],
        summary: 'Delete an exam (Admin only)',
        params: examParamsSchema,
      },
      handler: examsController.deleteExam,
    });

    // Add question to exam
    typedApp.post('/exams/:id/questions', {
      schema: {
        tags: ['Admin - Exam Questions'],
        summary: 'Add question to an exam (Admin only)',
        params: examParamsSchema,
        body: createExamQuestionSchema,
      },
      handler: examsController.addQuestion,
    });

    // Update question
    typedApp.put('/exam-questions/:questionId', {
      schema: {
        tags: ['Admin - Exam Questions'],
        summary: 'Update an exam question (Admin only)',
        params: examQuestionParamsSchema,
        body: updateExamQuestionSchema,
      },
      handler: examsController.updateQuestion,
    });

    // Delete question
    typedApp.delete('/exam-questions/:questionId', {
      schema: {
        tags: ['Admin - Exam Questions'],
        summary: 'Delete an exam question (Admin only)',
        params: examQuestionParamsSchema,
      },
      handler: examsController.deleteQuestion,
    });
  });
}
