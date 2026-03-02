import { coursesRepository } from './courses.repository.js';
import { auditLogsService } from '../audit-logs/audit-logs.service.js';
import type { 
  CreateCategoryInput, 
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  CreateCourseInput,
  UpdateCourseInput
} from './courses.schema.js';

export const coursesService = {
  // Category logic
  async listCategories() {
    return await coursesRepository.listCategories();
  },

  async getCategory(id: number) {
    return await coursesRepository.getCategoryById(id);
  },

  async createCategory(data: CreateCategoryInput, adminId?: string, ipAddress?: string) {
    const category = await coursesRepository.createCategory(data);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_CATEGORY',
        targetTable: 'categories',
        newValue: category,
        ipAddress,
      });
    }
    return category;
  },

  async updateCategory(id: number, data: UpdateCategoryInput, adminId?: string, ipAddress?: string) {
    const oldCategory = await coursesRepository.getCategoryById(id);
    const category = await coursesRepository.updateCategory(id, data);
    if (adminId && category) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_CATEGORY',
        targetTable: 'categories',
        oldValue: oldCategory,
        newValue: category,
        ipAddress,
      });
    }
    return category;
  },

  async deleteCategory(id: number, adminId?: string, ipAddress?: string) {
    const oldCategory = await coursesRepository.getCategoryById(id);
    const result = await coursesRepository.deleteCategory(id);
    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_CATEGORY',
        targetTable: 'categories',
        oldValue: oldCategory,
        ipAddress,
      });
    }
    return result;
  },

  // Subcategory logic
  async listSubcategories(categoryId?: number) {
    return await coursesRepository.listSubcategories(categoryId);
  },

  async getSubcategory(id: number) {
    return await coursesRepository.getSubcategoryById(id);
  },

  async createSubcategory(data: CreateSubcategoryInput, adminId?: string, ipAddress?: string) {
    const subcategory = await coursesRepository.createSubcategory(data);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_SUBCATEGORY',
        targetTable: 'subcategories',
        newValue: subcategory,
        ipAddress,
      });
    }
    return subcategory;
  },

  async updateSubcategory(id: number, data: UpdateSubcategoryInput, adminId?: string, ipAddress?: string) {
    const oldSubcategory = await coursesRepository.getSubcategoryById(id);
    const subcategory = await coursesRepository.updateSubcategory(id, data);
    if (adminId && subcategory) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_SUBCATEGORY',
        targetTable: 'subcategories',
        oldValue: oldSubcategory,
        newValue: subcategory,
        ipAddress,
      });
    }
    return subcategory;
  },

  async deleteSubcategory(id: number, adminId?: string, ipAddress?: string) {
    const oldSubcategory = await coursesRepository.getSubcategoryById(id);
    const result = await coursesRepository.deleteSubcategory(id);
    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_SUBCATEGORY',
        targetTable: 'subcategories',
        oldValue: oldSubcategory,
        ipAddress,
      });
    }
    return result;
  },

  // Course logic
  async listCourses() {
    return await coursesRepository.listCourses();
  },

  async getCourse(id: number) {
    return await coursesRepository.getCourseById(id);
  },

  async createCourse(data: CreateCourseInput, adminId?: string, ipAddress?: string) {
    const course = await coursesRepository.createCourse(data);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_COURSE',
        targetTable: 'courses',
        newValue: course,
        ipAddress,
      });
    }
    return course;
  },

  async updateCourse(id: number, data: UpdateCourseInput, adminId?: string, ipAddress?: string) {
    const oldCourse = await coursesRepository.getCourseById(id);
    const course = await coursesRepository.updateCourse(id, data);
    if (adminId && course) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_COURSE',
        targetTable: 'courses',
        oldValue: oldCourse,
        newValue: course,
        ipAddress,
      });
    }
    return course;
  },

  async deleteCourse(id: number, adminId?: string, ipAddress?: string) {
    const oldCourse = await coursesRepository.getCourseById(id);
    const result = await coursesRepository.deleteCourse(id);
    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_COURSE',
        targetTable: 'courses',
        oldValue: oldCourse,
        ipAddress,
      });
    }
    return result;
  },
};
