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
  categoryParamsSchema as courseParamsSchema,
  categoryParamsSchema,
} from './courses.schema.js';

export async function coursesRoutes(app: FastifyInstance) {
  await app.register(async (publicApp) => {
    const typedPublicApp = publicApp.withTypeProvider<ZodTypeProvider>();

    typedPublicApp.get('/public/courses', {
      schema: {
        tags: ['Public - Courses'],
        summary: 'List published courses',
      },
      handler: coursesController.listPublicCourses,
    });

    typedPublicApp.get('/public/courses/:id', {
      schema: {
        tags: ['Public - Courses'],
        summary: 'Get published course by ID',
        params: courseParamsSchema,
      },
      handler: coursesController.getPublicCourse,
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
      },
      handler: coursesController.listCourses,
    });

    // Enrolled courses for current user (must be before :id route)
    typedApp.get('/courses/my-courses', {
      schema: {
        tags: ['Courses'],
        summary: 'List my enrolled courses',
      },
      handler: coursesController.listMyEnrolledCourses,
    });

    typedApp.get('/courses/:id', {
      schema: {
        tags: ['Courses'],
        summary: 'Get course by ID',
        params: courseParamsSchema,
      },
      handler: coursesController.getCourse,
    });

    // Enroll in a course
    typedApp.post('/courses/:id/enroll', {
      schema: {
        tags: ['Courses'],
        summary: 'Enroll in a course',
        params: courseParamsSchema,
      },
      handler: coursesController.enrollCourse,
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
    });
  });
}
