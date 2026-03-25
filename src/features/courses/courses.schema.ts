import { z } from 'zod';

const MAX_LESSON_DOCUMENT_BYTES = 20 * 1024 * 1024;

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().max(50).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// Subcategory schemas
export const createSubcategorySchema = z.object({
  categoryId: z.number(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().max(50).optional(),
});

export const updateSubcategorySchema = createSubcategorySchema.partial();

// Course schemas
export const createCourseSchema = z.object({
  categoryId: z.number().optional().nullable(),
  subcategoryId: z.number().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  authorName: z.string().max(255).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  thumbnailMimeType: z.string().max(255).optional().nullable(),
  previewVideoId: z.number().optional().nullable(),
  cpeCredits: z.number().min(0).optional().nullable(),
  conferenceCode: z.string().max(255).optional().nullable(),
  language: z.string().max(50).optional().nullable(),
  audience: z.enum(['all', 'general', 'pharmacist']).optional().default('all'),
  skillLevel: z.string().max(50).optional().nullable().default('ALL'),
  hasCertificate: z.boolean().optional().nullable().default(false),
  maxStudents: z.number().int().positive().optional().nullable(),
  enrollmentDeadline: z.string().optional().nullable(),
  courseEndAt: z.string().optional().nullable(),
  relatedCourseIds: z.array(z.number().int().positive()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export const updateCourseSchema = createCourseSchema.partial();

export const categoryParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const courseParamsSchema = categoryParamsSchema;

export const courseListQuerySchema = z.object({
  categoryId: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
});

export const enrolledCourseListQuerySchema = z.object({
  status: z.enum(['active', 'cancelled', 'all']).optional().default('active'),
});

export const courseIdParamsSchema = z.object({
  courseId: z.string().transform((val) => parseInt(val, 10)),
});

export const lessonIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const lessonQuizIdParamsSchema = z.object({
  quizId: z.string().transform((val) => parseInt(val, 10)),
});

export const lessonQuizQuestionIdParamsSchema = z.object({
  questionId: z.string().transform((val) => parseInt(val, 10)),
});

export const examIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const examQuestionIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const videoIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const videoListQuerySchema = z.object({
  search: z.string().optional(),
  provider: z.enum(['VIMEO', 'YOUTUBE', 'CLOUDFLARE', 'S3']).optional(),
  status: z.enum(['PROCESSING', 'READY', 'FAILED']).optional(),
  used: z.enum(['true', 'false']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const createLessonSchema = z.object({
  title: z.string().min(1).max(255),
  videoId: z.number().int().positive(),
  sequenceOrder: z.number().int().positive(),
});

export const updateLessonSchema = createLessonSchema.partial();

export const createLessonDocumentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_LESSON_DOCUMENT_BYTES, 'ไฟล์เอกสารต้องไม่เกิน 20MB ต่อไฟล์'),
  fileUrl: z.string().min(1),
});

export const lessonDocumentIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

const questionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  isCorrect: z.boolean().optional(),
});

export const createVideoQuestionSchema = z.object({
  questionText: z.string().min(1),
  displayAtSeconds: z.number().int().min(0),
  sortOrder: z.number().int().min(0).optional(),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().optional().nullable(),
});

export const createVideoQuestionBulkSchema = z.object({
  questions: z.array(createVideoQuestionSchema).min(1),
});

export const updateVideoQuestionSchema = createVideoQuestionSchema.partial();

export const videoQuestionIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const createVideoQuestionAnswerSchema = z.object({
  answerGiven: z.string().trim().min(1),
});

export const updateLessonProgressSchema = z.object({
  lastWatchedSeconds: z.number().int().min(0),
});

export const updateCourseRelatedSchema = z.object({
  relatedCourseIds: z.array(z.number().int().positive()),
});

export const createLessonQuizSchema = z.object({
  passingScorePercent: z.number().int().min(0).max(100).default(70),
  maxAttempts: z.number().int().positive().optional().nullable(),
  questions: z.array(z.object({
    questionText: z.string().min(1),
    questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
    options: z.array(questionOptionSchema).optional(),
    correctAnswer: z.string().optional().nullable(),
    scoreWeight: z.number().int().positive().default(1),
  })).optional(),
});

export const updateLessonQuizSchema = createLessonQuizSchema.partial();

export const createLessonQuizQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().optional().nullable(),
  scoreWeight: z.number().int().positive().default(1),
});

export const updateLessonQuizQuestionSchema = createLessonQuizQuestionSchema.partial();

export const createLessonQuizAttemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.number().int().positive(),
    answerGiven: z.string().trim().min(1),
  })).min(1),
});

export const cancelCourseSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const createExamSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(255).optional().nullable(),
  passingScorePercent: z.number().int().min(0).max(100).default(70),
  timeLimitMinutes: z.number().int().positive().optional().nullable(),
});

export const updateExamSchema = createExamSchema.partial();

export const createExamQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  options: z.array(questionOptionSchema).optional(),
  scoreWeight: z.number().int().positive().default(1),
  correctAnswer: z.string().optional().nullable(),
});

export const updateExamQuestionSchema = createExamQuestionSchema.partial();

export const createVideoUploadInitiateSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1).max(255),
});

export const completeVideoUploadSchema = z.object({
  uploadSessionId: z.string().min(1),
  name: z.string().min(1).max(255),
  provider: z.enum(['VIMEO', 'YOUTUBE', 'CLOUDFLARE', 'S3']).default('VIMEO'),
  resourceId: z.string().min(1).max(255),
  videoUri: z.string().min(1).max(255).optional(),
  duration: z.number().int().nonnegative().optional(),
});

export const reviewListQuerySchema = z.object({
  limit: z.string().optional(),
});

export const createCourseReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(255).optional(),
  body: z.string().min(1).max(2000).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type CreateLessonDocumentInput = z.infer<typeof createLessonDocumentSchema>;
export type CreateVideoQuestionInput = z.infer<typeof createVideoQuestionSchema>;
export type CreateVideoQuestionBulkInput = z.infer<typeof createVideoQuestionBulkSchema>;
export type UpdateVideoQuestionInput = z.infer<typeof updateVideoQuestionSchema>;
export type CreateVideoQuestionAnswerInput = z.infer<typeof createVideoQuestionAnswerSchema>;
export type UpdateLessonProgressInput = z.infer<typeof updateLessonProgressSchema>;
export type UpdateCourseRelatedInput = z.infer<typeof updateCourseRelatedSchema>;
export type CreateLessonQuizInput = z.infer<typeof createLessonQuizSchema>;
export type UpdateLessonQuizInput = z.infer<typeof updateLessonQuizSchema>;
export type CreateLessonQuizQuestionInput = z.infer<typeof createLessonQuizQuestionSchema>;
export type UpdateLessonQuizQuestionInput = z.infer<typeof updateLessonQuizQuestionSchema>;
export type CreateLessonQuizAttemptInput = z.infer<typeof createLessonQuizAttemptSchema>;
export type CancelCourseInput = z.infer<typeof cancelCourseSchema>;
export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CreateExamQuestionInput = z.infer<typeof createExamQuestionSchema>;
export type UpdateExamQuestionInput = z.infer<typeof updateExamQuestionSchema>;
export type ReviewListQueryInput = z.infer<typeof reviewListQuerySchema>;
export type CreateCourseReviewInput = z.infer<typeof createCourseReviewSchema>;
export const resolveVimeoVideoSchema = z.object({
  url: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
}).refine(
  (data) => !!(data.url || data.resourceId),
  { message: 'ต้องระบุ url หรือ resourceId อย่างน้อยหนึ่งค่า' }
).refine(
  (data) => !(data.url && data.resourceId),
  { message: 'ระบุได้แค่ url หรือ resourceId อย่างใดอย่างหนึ่ง' }
);

export const importVimeoVideoSchema = z.object({
  url: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  name: z.string().max(255).optional(),
}).refine(
  (data) => !!(data.url || data.resourceId),
  { message: 'ต้องระบุ url หรือ resourceId อย่างน้อยหนึ่งค่า' }
).refine(
  (data) => !(data.url && data.resourceId),
  { message: 'ระบุได้แค่ url หรือ resourceId อย่างใดอย่างหนึ่ง' }
);

export type CreateVideoUploadInitiateInput = z.infer<typeof createVideoUploadInitiateSchema>;
export type CompleteVideoUploadInput = z.infer<typeof completeVideoUploadSchema>;
export type ResolveVimeoVideoInput = z.infer<typeof resolveVimeoVideoSchema>;
export type ImportVimeoVideoInput = z.infer<typeof importVimeoVideoSchema>;
export type VideoListQueryInput = z.infer<typeof videoListQuerySchema>;
export type EnrolledCourseListQueryInput = z.infer<typeof enrolledCourseListQuerySchema>;

export const refundRequestIdParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const resolveRefundRequestSchema = z.object({
  adminNote: z.string().trim().max(1000).optional(),
});

export type ResolveRefundRequestInput = z.infer<typeof resolveRefundRequestSchema>;
