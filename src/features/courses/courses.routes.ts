import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { coursesController } from './courses.controller.js';
import { enrollmentController } from './enrollment.controller.js';
import { lessonsController } from './lessons.controller.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  createCourseSchema,
  updateCourseSchema,
  createLessonSchema,
  updateLessonSchema,
  lessonParamsSchema,
  categoryParamsSchema as courseParamsSchema,
  categoryParamsSchema,
} from './courses.schema.js';

export async function coursesRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // ==========================================
  // Public routes (no authentication required)
  // ==========================================
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

  typedApp.get('/courses', {
    schema: {
      tags: ['Courses'],
      summary: 'List all courses',
      querystring: z.object({
        page: z.coerce.number().default(1),
        limit: z.coerce.number().default(20),
      }),
    },
    handler: coursesController.listCourses,
  });

  typedApp.get('/courses/featured', {
    schema: {
      tags: ['Courses'],
      summary: 'Get featured courses (latest published)',
      querystring: z.object({ limit: z.coerce.number().default(6) }),
    },
    handler: enrollmentController.getFeaturedCourses,
  });

  typedApp.get('/courses/popular', {
    schema: {
      tags: ['Courses'],
      summary: 'Get popular courses (most enrollments)',
      querystring: z.object({ limit: z.coerce.number().default(8) }),
    },
    handler: enrollmentController.getPopularCourses,
  });

  typedApp.get('/courses/:id', {
    schema: {
      tags: ['Courses'],
      summary: 'Get course by ID',
      params: courseParamsSchema,
    },
    handler: coursesController.getCourse,
  });

  typedApp.get('/courses/:id/thumbnail', {
    schema: {
      tags: ['Courses'],
      summary: 'Get course thumbnail image',
      params: courseParamsSchema,
    },
    handler: coursesController.getCourseThumbnail,
  });

  // ==========================================
  // Authenticated routes (login required)
  // ==========================================
  app.register(async (authApp) => {
    authApp.addHook('onRequest', app.authenticate);
    const typedAuthApp = authApp.withTypeProvider<ZodTypeProvider>();

    typedAuthApp.get('/courses/enrolled', {
      schema: {
        tags: ['Courses - Enrollment'],
        summary: 'Get courses enrolled by current user',
      },
      handler: enrollmentController.getEnrolledCourses,
    });

    typedAuthApp.post('/courses/:id/enroll', {
      schema: {
        tags: ['Courses - Enrollment'],
        summary: 'Enroll in a course',
        params: courseParamsSchema,
      },
      handler: enrollmentController.enroll,
    });

    typedAuthApp.get('/courses/:id/progress', {
      schema: {
        tags: ['Courses - Enrollment'],
        summary: 'Get progress for an enrolled course',
        params: courseParamsSchema,
      },
      handler: enrollmentController.getCourseProgress,
    });

    typedAuthApp.post('/courses/:id/lessons/:lessonId/complete', {
      schema: {
        tags: ['Courses - Enrollment'],
        summary: 'Mark a lesson as complete',
        params: z.object({
          id: z.string().transform(v => parseInt(v, 10)),
          lessonId: z.string().transform(v => parseInt(v, 10)),
        }),
      },
      handler: enrollmentController.markLessonComplete,
    });
  });

  // ==========================================
  // Admin only routes
  // ==========================================
  const requireAdmin = app.requireRole('admin', 'super_admin');

  // Admin only Category routes
  app.register(async (adminApp) => {
    adminApp.addHook('onRequest', requireAdmin);

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

    // Lesson Admin Routes
    typedAdminApp.get('/courses/:id/lessons', {
      schema: {
        tags: ['Admin - Lessons'],
        summary: 'List lessons for a course (Admin only)',
        params: courseParamsSchema,
      },
      handler: lessonsController.listLessons,
    });

    typedAdminApp.post('/courses/:id/lessons', {
      schema: {
        tags: ['Admin - Lessons'],
        summary: 'Create lesson for a course (Admin only)',
        params: courseParamsSchema,
        body: createLessonSchema,
      },
      handler: lessonsController.createLesson,
    });

    typedAdminApp.put('/lessons/:lessonId', {
      schema: {
        tags: ['Admin - Lessons'],
        summary: 'Update a lesson (Admin only)',
        params: lessonParamsSchema,
        body: updateLessonSchema,
      },
      handler: lessonsController.updateLesson,
    });

    typedAdminApp.delete('/lessons/:lessonId', {
      schema: {
        tags: ['Admin - Lessons'],
        summary: 'Delete a lesson (Admin only)',
        params: lessonParamsSchema,
      },
      handler: lessonsController.deleteLesson,
    });
  });
}
