import { coursesRepository } from './courses.repository.js';
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

  async createCategory(data: CreateCategoryInput) {
    return await coursesRepository.createCategory(data);
  },

  async updateCategory(id: number, data: UpdateCategoryInput) {
    return await coursesRepository.updateCategory(id, data);
  },

  async deleteCategory(id: number) {
    return await coursesRepository.deleteCategory(id);
  },

  // Subcategory logic
  async listSubcategories(categoryId?: number) {
    return await coursesRepository.listSubcategories(categoryId);
  },

  async getSubcategory(id: number) {
    return await coursesRepository.getSubcategoryById(id);
  },

  async createSubcategory(data: CreateSubcategoryInput) {
    return await coursesRepository.createSubcategory(data);
  },

  async updateSubcategory(id: number, data: UpdateSubcategoryInput) {
    return await coursesRepository.updateSubcategory(id, data);
  },

  async deleteSubcategory(id: number) {
    return await coursesRepository.deleteSubcategory(id);
  },

  // Course logic
  async listCourses() {
    return await coursesRepository.listCourses();
  },

  async getCourse(id: number) {
    return await coursesRepository.getCourseById(id);
  },

  async createCourse(data: CreateCourseInput) {
    return await coursesRepository.createCourse(data);
  },

  async updateCourse(id: number, data: UpdateCourseInput) {
    return await coursesRepository.updateCourse(id, data);
  },

  async deleteCourse(id: number) {
    return await coursesRepository.deleteCourse(id);
  },
};
