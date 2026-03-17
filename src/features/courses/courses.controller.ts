import { FastifyReply, FastifyRequest } from 'fastify';
import { coursesService } from './courses.service.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  CreateCourseInput,
  UpdateCourseInput
} from './courses.schema.js';

export const coursesController = {
  // Category handlers
  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await coursesService.listCategories();
    return reply.send({ data: categories });
  },

  async getCategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const category = await coursesService.getCategory(request.params.id);
    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ data: category });
  },

  async createCategory(request: FastifyRequest<{ Body: CreateCategoryInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const category = await coursesService.createCategory(request.body, adminId, request.ip);
    return reply.status(201).send({ data: category });
  },

  async updateCategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCategoryInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const category = await coursesService.updateCategory(request.params.id, request.body, adminId, request.ip);
    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ data: category });
  },

  async deleteCategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const result = await coursesService.deleteCategory(request.params.id, adminId, request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ message: 'Category deleted successfully' });
  },

  // Subcategory handlers
  async listSubcategories(request: FastifyRequest<{ Querystring: { categoryId?: string } }>, reply: FastifyReply) {
    const categoryId = request.query.categoryId ? parseInt(request.query.categoryId, 10) : undefined;
    const subcategories = await coursesService.listSubcategories(categoryId);
    return reply.send({ data: subcategories });
  },

  async getSubcategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const subcategory = await coursesService.getSubcategory(request.params.id);
    if (!subcategory) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ data: subcategory });
  },

  async createSubcategory(request: FastifyRequest<{ Body: CreateSubcategoryInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const subcategory = await coursesService.createSubcategory(request.body, adminId, request.ip);
    return reply.status(201).send({ data: subcategory });
  },

  async updateSubcategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateSubcategoryInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const subcategory = await coursesService.updateSubcategory(request.params.id, request.body, adminId, request.ip);
    if (!subcategory) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ data: subcategory });
  },

  async deleteSubcategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const result = await coursesService.deleteSubcategory(request.params.id, adminId, request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ message: 'Subcategory deleted successfully' });
  },

  // Course handlers
  async listCourses(request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>, reply: FastifyReply) {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;
    const offset = (page - 1) * limit;
    const courses = await coursesService.listCourses(limit, offset);
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    const mapped = courses.map((c: any) => ({
      ...c,
      thumbnail: c.thumbnail ? `${baseUrl}/api/v1/courses/${c.id}/thumbnail` : null,
    }));
    return reply.send({ data: mapped });
  },

  async getCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getCourse(request.params.id);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    const data = {
      ...course,
      thumbnail: course.thumbnail ? `${baseUrl}/api/v1/courses/${course.id}/thumbnail` : null,
    };
    return reply.send({ data });
  },

  async createCourse(request: FastifyRequest<{ Body: CreateCourseInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const course = await coursesService.createCourse(request.body, adminId, request.ip);
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    return reply.status(201).send({
      data: {
        ...course,
        thumbnail: course.thumbnail ? `${baseUrl}/api/v1/courses/${course.id}/thumbnail` : null,
      },
    });
  },

  async updateCourse(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCourseInput }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const course = await coursesService.updateCourse(request.params.id, request.body, adminId, request.ip);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    return reply.send({
      data: {
        ...course,
        thumbnail: course.thumbnail ? `${baseUrl}/api/v1/courses/${course.id}/thumbnail` : null,
      },
    });
  },

  async deleteCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const adminId = (request.user as any)?.id;
    const result = await coursesService.deleteCourse(request.params.id, adminId, request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ message: 'Course deleted successfully' });
  },

  async getCourseThumbnail(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getCourse(request.params.id);
    if (!course || !course.thumbnail) {
      return reply.status(404).send({ message: 'Thumbnail not found' });
    }
    const mimeType = course.thumbnailMimeType || 'image/jpeg';
    const buffer = Buffer.from(course.thumbnail, 'base64');
    return reply
      .header('Content-Type', mimeType)
      .header('Cache-Control', 'public, max-age=86400')
      .send(buffer);
  },
};
