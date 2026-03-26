import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { coursesController } from './courses.controller.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  createCourseSchema,
  updateCourseSchema,
  categoryParamsSchema,
  courseListQuerySchema,
  enrolledCourseListQuerySchema,
  courseParamsSchema,
  courseIdParamsSchema,
  createLessonSchema,
  updateLessonSchema,
  lessonIdParamsSchema,
  createLessonDocumentSchema,
  lessonDocumentIdParamsSchema,
  createVideoQuestionSchema,
  createVideoQuestionBulkSchema,
  updateVideoQuestionSchema,
  createVideoQuestionAnswerSchema,
  videoQuestionIdParamsSchema,
  updateLessonProgressSchema,
  updateCourseRelatedSchema,
  createLessonQuizSchema,
  updateLessonQuizSchema,
  lessonQuizIdParamsSchema,
  createLessonQuizQuestionSchema,
  lessonQuizQuestionIdParamsSchema,
  updateLessonQuizQuestionSchema,
  createLessonQuizAttemptSchema,
  cancelCourseSchema,
  createExamSchema,
  updateExamSchema,
  examIdParamsSchema,
  createExamQuestionSchema,
  updateExamQuestionSchema,
  examQuestionIdParamsSchema,
  createVideoUploadInitiateSchema,
  completeVideoUploadSchema,
  videoIdParamsSchema,
  videoListQuerySchema,
  resolveVimeoVideoSchema,
  importVimeoVideoSchema,
  reviewListQuerySchema,
  createCourseReviewSchema,
  refundRequestIdParamsSchema,
  resolveRefundRequestSchema,
} from './courses.schema.js';

export async function coursesRoutes(app: FastifyInstance) {
  await app.register(async (publicApp) => {
    const typedPublicApp = publicApp.withTypeProvider<ZodTypeProvider>();

    typedPublicApp.get('/public/courses', {
      schema: {
        tags: ['Public - Courses'],
        summary: 'List published courses',
        querystring: courseListQuerySchema,
      },
      handler: coursesController.listPublicCourses,
    });

    typedPublicApp.get('/public/categories', {
      schema: {
        tags: ['Public - Categories'],
        summary: 'List public categories with published course counts',
      },
      handler: coursesController.listPublicCategories,
    });

    typedPublicApp.get('/public/courses/:id', {
      schema: {
        tags: ['Public - Courses'],
        summary: 'Get published course by ID',
        params: courseParamsSchema,
      },
      handler: coursesController.getPublicCourse,
    });

    typedPublicApp.get('/public/courses/:id/reviews', {
      schema: {
        tags: ['Public - Courses'],
        summary: 'Get reviews and rating summary for a course',
        params: courseParamsSchema,
        querystring: reviewListQuerySchema,
      },
      handler: coursesController.getCourseReviews,
    });
  });

  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', app.authenticate);

    const typedApp = protectedApp.withTypeProvider<ZodTypeProvider>();

    // Categories routes
    typedApp.get('/categories', {
      schema: {
        tags: ['Courses - Categories'],
        summary: 'List all categories',
      },
      handler: coursesController.listCategories,
    });

    typedApp.get('/categories/:id', {
      schema: {
        tags: ['Courses - Categories'],
        summary: 'Get category by ID',
        params: categoryParamsSchema,
      },
      handler: coursesController.getCategory,
    });

    typedApp.get('/subcategories', {
      schema: {
        tags: ['Courses - Subcategories'],
        summary: 'List all subcategories',
        querystring: z.object({ categoryId: z.string().optional() }),
      },
      handler: coursesController.listSubcategories,
    });

    typedApp.get('/subcategories/:id', {
      schema: {
        tags: ['Courses - Subcategories'],
        summary: 'Get subcategory by ID',
        params: categoryParamsSchema,
      },
      handler: coursesController.getSubcategory,
    });

    // Course routes
    typedApp.get('/courses', {
      schema: {
        tags: ['Courses'],
        summary: 'List all courses',
        querystring: courseListQuerySchema,
      },
      handler: coursesController.listCourses,
    });

    typedApp.get('/courses/enrolled', {
      schema: {
        tags: ['Courses'],
        summary: 'List enrolled courses for current user',
        querystring: enrolledCourseListQuerySchema,
      },
      handler: coursesController.listEnrolledCourses,
    });

    typedApp.get('/courses/:id', {
      schema: {
        tags: ['Courses'],
        summary: 'Get course by ID',
        params: courseParamsSchema,
      },
      handler: coursesController.getCourse,
    });

    typedApp.get('/courses/:id/learning', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Get enrolled course learning data',
        params: courseParamsSchema,
      },
      handler: coursesController.getCourseLearning,
    });

    typedApp.get('/courses/:id/progress', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Get enrolled course progress',
        params: courseParamsSchema,
      },
      handler: coursesController.getCourseProgress,
    });

    typedApp.get('/courses/:courseId/reviews/eligibility', {
      schema: {
        tags: ['Courses - Reviews'],
        summary: 'Check if current user can submit a review for a course',
        params: courseIdParamsSchema,
      },
      handler: coursesController.getCourseReviewEligibility,
    });

    typedApp.post('/courses/:courseId/reviews', {
      schema: {
        tags: ['Courses - Reviews'],
        summary: 'Submit or update a course review after completion',
        params: courseIdParamsSchema,
        body: createCourseReviewSchema,
      },
      handler: coursesController.createCourseReview,
    });

    typedApp.post('/courses/:id/enroll', {
      schema: {
        tags: ['Courses'],
        summary: 'Enroll current user to a course',
        params: courseParamsSchema,
      },
      handler: coursesController.enrollCourse,
    });

    typedApp.post('/courses/:id/cancel', {
      schema: {
        tags: ['Courses'],
        summary: 'Cancel enrolled course for current user',
        params: courseParamsSchema,
        body: cancelCourseSchema,
      },
      handler: coursesController.cancelCourse,
    });

    typedApp.post('/courses/:courseId/lessons/:lessonId/complete', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Mark lesson as complete for enrolled user',
        params: z.object({
          courseId: z.string().transform((val) => parseInt(val, 10)),
          lessonId: z.string().transform((val) => parseInt(val, 10)),
        }),
      },
      handler: coursesController.completeLesson,
    });

    typedApp.post('/courses/:courseId/lessons/:lessonId/video-status/sync', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Sync lesson video status for learner before playback',
        params: z.object({
          courseId: z.string().transform((val) => parseInt(val, 10)),
          lessonId: z.string().transform((val) => parseInt(val, 10)),
        }),
      },
      handler: coursesController.syncLearningLessonVideo,
    });

    typedApp.patch('/lessons/:id/progress', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Update lesson playback progress',
        params: lessonIdParamsSchema,
        body: updateLessonProgressSchema,
      },
      handler: coursesController.updateLessonProgress,
    });

    typedApp.post('/video-questions/:id/answer', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Submit answer for an interactive video question',
        params: videoQuestionIdParamsSchema,
        body: createVideoQuestionAnswerSchema,
      },
      handler: coursesController.answerVideoQuestion,
    });

    typedApp.get('/lessons/:id/quiz-runtime', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Get lesson quiz details for learner',
        params: lessonIdParamsSchema,
      },
      handler: coursesController.getLessonQuizRuntime,
    });

    typedApp.post('/lessons/:id/quiz-attempts', {
      schema: {
        tags: ['Courses - Learning'],
        summary: 'Submit lesson quiz answers',
        params: lessonIdParamsSchema,
        body: createLessonQuizAttemptSchema,
      },
      handler: coursesController.submitLessonQuizAttempt,
    });

    // Admin only Category routes
    protectedApp.register(async (adminApp) => {
      adminApp.addHook('onRequest', app.requireRole('admin', 'super_admin', 'system_admin'));

      const typedAdminApp = adminApp.withTypeProvider<ZodTypeProvider>();

      // Category Admin Routes
      typedAdminApp.post('/categories', {
        schema: {
          tags: ['Admin - Categories'],
          summary: 'Create new category (Admin only)',
          body: createCategorySchema,
        },
        handler: coursesController.createCategory,
      });

      typedAdminApp.put('/categories/:id', {
        schema: {
          tags: ['Admin - Categories'],
          summary: 'Update category (Admin only)',
          params: categoryParamsSchema,
          body: updateCategorySchema,
        },
        handler: coursesController.updateCategory,
      });

      typedAdminApp.delete('/categories/:id', {
        schema: {
          tags: ['Admin - Categories'],
          summary: 'Delete category (Admin only)',
          params: categoryParamsSchema,
        },
        handler: coursesController.deleteCategory,
      });

      // Subcategory Admin Routes
      typedAdminApp.post('/subcategories', {
        schema: {
          tags: ['Admin - Subcategories'],
          summary: 'Create new subcategory (Admin only)',
          body: createSubcategorySchema,
        },
        handler: coursesController.createSubcategory,
      });

      typedAdminApp.put('/subcategories/:id', {
        schema: {
          tags: ['Admin - Subcategories'],
          summary: 'Update subcategory (Admin only)',
          params: categoryParamsSchema,
          body: updateSubcategorySchema,
        },
        handler: coursesController.updateSubcategory,
      });

      typedAdminApp.delete('/subcategories/:id', {
        schema: {
          tags: ['Admin - Subcategories'],
          summary: 'Delete subcategory (Admin only)',
          params: categoryParamsSchema,
        },
        handler: coursesController.deleteSubcategory,
      });

      // Course Admin Routes
      typedAdminApp.post('/courses', {
        schema: {
          tags: ['Admin - Courses'],
          summary: 'Create new course (Admin only)',
          body: createCourseSchema,
        },
        handler: coursesController.createCourse,
      });

      typedAdminApp.put('/courses/:id', {
        schema: {
          tags: ['Admin - Courses'],
          summary: 'Update course (Admin only)',
          params: courseParamsSchema,
          body: updateCourseSchema,
        },
        handler: coursesController.updateCourse,
      });

      typedAdminApp.delete('/courses/:id', {
        schema: {
          tags: ['Admin - Courses'],
          summary: 'Delete course (Admin only)',
          params: courseParamsSchema,
        },
        handler: coursesController.deleteCourse,
      });

      typedAdminApp.put('/courses/:id/related', {
        schema: {
          tags: ['Admin - Courses'],
          summary: 'Replace related courses (Admin only)',
          params: courseParamsSchema,
          body: updateCourseRelatedSchema,
        },
        handler: coursesController.replaceRelatedCourses,
      });

      typedAdminApp.get('/courses/:courseId/lessons', {
        schema: {
          tags: ['Admin - Lessons'],
          summary: 'List lessons by course (Admin only)',
          params: courseIdParamsSchema,
        },
        handler: coursesController.listLessons,
      });

      typedAdminApp.post('/courses/:courseId/lessons', {
        schema: {
          tags: ['Admin - Lessons'],
          summary: 'Create lesson (Admin only)',
          params: courseIdParamsSchema,
          body: createLessonSchema,
        },
        handler: coursesController.createLesson,
      });

      typedAdminApp.put('/lessons/:id', {
        schema: {
          tags: ['Admin - Lessons'],
          summary: 'Update lesson (Admin only)',
          params: lessonIdParamsSchema,
          body: updateLessonSchema,
        },
        handler: coursesController.updateLesson,
      });

      typedAdminApp.delete('/lessons/:id', {
        schema: {
          tags: ['Admin - Lessons'],
          summary: 'Delete lesson (Admin only)',
          params: lessonIdParamsSchema,
        },
        handler: coursesController.deleteLesson,
      });

      typedAdminApp.post('/lessons/:id/documents', {
        schema: {
          tags: ['Admin - Lesson Documents'],
          summary: 'Add lesson document (Admin only)',
          params: lessonIdParamsSchema,
          body: createLessonDocumentSchema,
        },
        handler: coursesController.addLessonDocument,
      });

      typedAdminApp.get('/lesson-documents/:id', {
        schema: {
          tags: ['Admin - Lesson Documents'],
          summary: 'Get lesson document by ID (Admin only)',
          params: lessonDocumentIdParamsSchema,
        },
        handler: coursesController.getLessonDocument,
      });

      typedAdminApp.delete('/lesson-documents/:id', {
        schema: {
          tags: ['Admin - Lesson Documents'],
          summary: 'Delete lesson document (Admin only)',
          params: lessonDocumentIdParamsSchema,
        },
        handler: coursesController.deleteLessonDocument,
      });

      typedAdminApp.post('/lessons/:id/video-questions', {
        schema: {
          tags: ['Admin - Video Questions'],
          summary: 'Add interactive video question (Admin only)',
          params: lessonIdParamsSchema,
          body: createVideoQuestionSchema,
        },
        handler: coursesController.addVideoQuestion,
      });

      typedAdminApp.post('/lessons/:id/video-questions/bulk', {
        schema: {
          tags: ['Admin - Video Questions'],
          summary: 'Bulk import interactive video questions (Admin only)',
          params: lessonIdParamsSchema,
          body: createVideoQuestionBulkSchema,
        },
        handler: coursesController.addVideoQuestionsBulk,
      });

      typedAdminApp.delete('/video-questions/:id', {
        schema: {
          tags: ['Admin - Video Questions'],
          summary: 'Delete interactive video question (Admin only)',
          params: videoQuestionIdParamsSchema,
        },
        handler: coursesController.deleteVideoQuestion,
      });

      typedAdminApp.put('/video-questions/:id', {
        schema: {
          tags: ['Admin - Video Questions'],
          summary: 'Update interactive video question (Admin only)',
          params: videoQuestionIdParamsSchema,
          body: updateVideoQuestionSchema,
        },
        handler: coursesController.updateVideoQuestion,
      });

      typedAdminApp.get('/lessons/:id/quiz', {
        schema: {
          tags: ['Admin - Lesson Quiz'],
          summary: 'Get lesson quiz (Admin only)',
          params: lessonIdParamsSchema,
        },
        handler: coursesController.getLessonQuiz,
      });

      typedAdminApp.put('/lessons/:id/quiz', {
        schema: {
          tags: ['Admin - Lesson Quiz'],
          summary: 'Create or update lesson quiz (Admin only)',
          params: lessonIdParamsSchema,
          body: updateLessonQuizSchema.or(createLessonQuizSchema),
        },
        handler: coursesController.upsertLessonQuiz,
      });

      typedAdminApp.post('/lesson-quizzes/:quizId/questions', {
        schema: {
          tags: ['Admin - Lesson Quiz'],
          summary: 'Add lesson quiz question (Admin only)',
          params: lessonQuizIdParamsSchema,
          body: createLessonQuizQuestionSchema,
        },
        handler: coursesController.createLessonQuizQuestion,
      });

      typedAdminApp.put('/lesson-quiz-questions/:questionId', {
        schema: {
          tags: ['Admin - Lesson Quiz'],
          summary: 'Update lesson quiz question (Admin only)',
          params: lessonQuizQuestionIdParamsSchema,
          body: updateLessonQuizQuestionSchema,
        },
        handler: coursesController.updateLessonQuizQuestion,
      });

      typedAdminApp.delete('/lesson-quiz-questions/:questionId', {
        schema: {
          tags: ['Admin - Lesson Quiz'],
          summary: 'Delete lesson quiz question (Admin only)',
          params: lessonQuizQuestionIdParamsSchema,
        },
        handler: coursesController.deleteLessonQuizQuestion,
      });

      typedAdminApp.get('/courses/:courseId/exam', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Get course exam (Admin only)',
          params: courseIdParamsSchema,
        },
        handler: coursesController.getExam,
      });

      typedAdminApp.post('/courses/:courseId/exam', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Create or update course exam (Admin only)',
          params: courseIdParamsSchema,
          body: createExamSchema,
        },
        handler: coursesController.saveExam,
      });

      typedAdminApp.put('/exams/:id', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Update exam (Admin only)',
          params: examIdParamsSchema,
          body: updateExamSchema,
        },
        handler: coursesController.updateExam,
      });

      typedAdminApp.delete('/exams/:id', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Delete exam (Admin only)',
          params: examIdParamsSchema,
        },
        handler: coursesController.deleteExam,
      });

      typedAdminApp.post('/exams/:id/questions', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Add exam question (Admin only)',
          params: examIdParamsSchema,
          body: createExamQuestionSchema,
        },
        handler: coursesController.addExamQuestion,
      });

      typedAdminApp.put('/exam-questions/:id', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Update exam question (Admin only)',
          params: examQuestionIdParamsSchema,
          body: updateExamQuestionSchema,
        },
        handler: coursesController.updateExamQuestion,
      });

      typedAdminApp.delete('/exam-questions/:id', {
        schema: {
          tags: ['Admin - Exams'],
          summary: 'Delete exam question (Admin only)',
          params: examQuestionIdParamsSchema,
        },
        handler: coursesController.deleteExamQuestion,
      });

      typedAdminApp.post('/videos/vimeo/initiate', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Initiate video upload (Admin only)',
          body: createVideoUploadInitiateSchema,
        },
        handler: coursesController.initiateVideoUpload,
      });

      typedAdminApp.get('/videos', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'List videos with usage and status (Admin only)',
          querystring: videoListQuerySchema,
        },
        handler: coursesController.listVideos,
      });

      typedAdminApp.get('/videos/:id', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Get video by ID with usage summary (Admin only)',
          params: videoIdParamsSchema,
        },
        handler: coursesController.getVideo,
      });

      typedAdminApp.post('/videos/vimeo/complete', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Complete video upload (Admin only)',
          body: completeVideoUploadSchema,
        },
        handler: coursesController.completeVideoUpload,
      });

      typedAdminApp.post('/videos/vimeo/resolve', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Resolve existing Vimeo video metadata (Admin only)',
          body: resolveVimeoVideoSchema,
        },
        handler: coursesController.resolveVimeoVideo,
      });

      typedAdminApp.post('/videos/vimeo/import', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Import existing Vimeo video into system (Admin only)',
          body: importVimeoVideoSchema,
        },
        handler: coursesController.importVimeoVideo,
      });

      typedAdminApp.delete('/videos/:id', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Delete video (Admin only)',
          params: videoIdParamsSchema,
        },
        handler: coursesController.deleteVideo,
      });

      typedAdminApp.post('/videos/:id/sync-status', {
        schema: {
          tags: ['Admin - Videos'],
          summary: 'Sync Vimeo video status from provider (Admin only)',
          params: videoIdParamsSchema,
        },
        handler: coursesController.syncVideoStatus,
      });

      typedAdminApp.get('/admin/refund-requests', {
        schema: {
          tags: ['Admin - Refund Requests'],
          summary: 'List learner refund requests (Admin only)',
        },
        handler: coursesController.listRefundRequests,
      });

      typedAdminApp.post('/admin/refund-requests/:id/approve', {
        schema: {
          tags: ['Admin - Refund Requests'],
          summary: 'Approve learner refund request (Admin only)',
          params: refundRequestIdParamsSchema,
          body: resolveRefundRequestSchema,
        },
        handler: coursesController.approveRefundRequest,
      });

      typedAdminApp.post('/admin/refund-requests/:id/reject', {
        schema: {
          tags: ['Admin - Refund Requests'],
          summary: 'Reject learner refund request (Admin only)',
          params: refundRequestIdParamsSchema,
          body: resolveRefundRequestSchema,
        },
        handler: coursesController.rejectRefundRequest,
      });
    });
  });
}
