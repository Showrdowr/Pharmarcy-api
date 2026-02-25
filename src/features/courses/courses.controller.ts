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
    const category = await coursesService.createCategory(request.body);
    return reply.status(201).send({ data: category });
  },

  async updateCategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCategoryInput }>, reply: FastifyReply) {
    const category = await coursesService.updateCategory(request.params.id, request.body);
    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ data: category });
  },

  async deleteCategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteCategory(request.params.id);
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
    const subcategory = await coursesService.createSubcategory(request.body);
    return reply.status(201).send({ data: subcategory });
  },

  async updateSubcategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateSubcategoryInput }>, reply: FastifyReply) {
    const subcategory = await coursesService.updateSubcategory(request.params.id, request.body);
    if (!subcategory) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ data: subcategory });
  },

  async deleteSubcategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteSubcategory(request.params.id);
    if (!result) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ message: 'Subcategory deleted successfully' });
  },

  // Course handlers
  async listCourses(request: FastifyRequest, reply: FastifyReply) {
    const courses = await coursesService.listCourses();
    return reply.send({ data: courses });
  },

  async getCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getCourse(request.params.id);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async createCourse(request: FastifyRequest<{ Body: CreateCourseInput }>, reply: FastifyReply) {
    const course = await coursesService.createCourse(request.body);
    return reply.status(201).send({ data: course });
  },

  async updateCourse(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCourseInput }>, reply: FastifyReply) {
    const course = await coursesService.updateCourse(request.params.id, request.body);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async deleteCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteCourse(request.params.id);
    if (!result) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ message: 'Course deleted successfully' });
  },
};
