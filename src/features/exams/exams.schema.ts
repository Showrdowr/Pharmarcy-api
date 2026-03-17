import { z } from 'zod';

export const createExamSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(255).optional().nullable(),
  passingScorePercent: z.number().min(0).max(100),
  timeLimitMinutes: z.number().min(1).optional().nullable(),
});

export const updateExamSchema = createExamSchema.partial();

export const createExamQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  options: z.any().optional().nullable(),
  scoreWeight: z.number().min(1),
  correctAnswer: z.string().optional().nullable(),
});

export const updateExamQuestionSchema = createExamQuestionSchema.partial();

export const examParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const examQuestionParamsSchema = z.object({
  questionId: z.string().transform((val) => parseInt(val, 10)),
});

export const courseExamParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CreateExamQuestionInput = z.infer<typeof createExamQuestionSchema>;
export type UpdateExamQuestionInput = z.infer<typeof updateExamQuestionSchema>;
