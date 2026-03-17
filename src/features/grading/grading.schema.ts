import { z } from 'zod';

export const gradingQuerySchema = z.object({
  courseId: z.coerce.number().optional(),
  examId: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const attemptParamsSchema = z.object({
  attemptId: z.coerce.number(),
});

export const submitGradesBodySchema = z.object({
  gradedAnswers: z.array(z.object({
    answerId: z.number(),
    pointsEarned: z.number().min(0),
    feedback: z.string().optional(),
  })).min(1),
});

export type GradingQuery = z.infer<typeof gradingQuerySchema>;
export type AttemptParams = z.infer<typeof attemptParamsSchema>;
export type SubmitGradesBody = z.infer<typeof submitGradesBodySchema>;
