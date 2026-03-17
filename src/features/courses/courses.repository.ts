import { db } from '../../db/index.js';
import { categories, subcategories, courses } from '../../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  CreateCourseInput,
  UpdateCourseInput
} from './courses.schema.js';

export const coursesRepository = {
  // Category operations
  async listCategories() {
    return await db.query.categories.findMany({
      with: {
        subcategories: true,
      },
    });
  },

  async getCategoryById(id: number) {
    return await db.query.categories.findFirst({
      where: eq(categories.id, id),
      with: {
        subcategories: true,
      },
    });
  },

  async createCategory(data: CreateCategoryInput) {
    const [result] = await db.insert(categories).values(data).returning();
    return result;
  },

  async updateCategory(id: number, data: UpdateCategoryInput) {
    const [result] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return result;
  },

  async deleteCategory(id: number) {
    const [result] = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result;
  },

  // Subcategory operations
  async listSubcategories(categoryId?: number) {
    return await db.query.subcategories.findMany({
      where: categoryId ? eq(subcategories.categoryId, categoryId) : undefined,
    });
  },

  async getSubcategoryById(id: number) {
    return await db.query.subcategories.findFirst({
      where: eq(subcategories.id, id),
    });
  },

  async createSubcategory(data: CreateSubcategoryInput) {
    const [result] = await db.insert(subcategories).values(data).returning();
    return result;
  },

  async updateSubcategory(id: number, data: UpdateSubcategoryInput) {
    const [result] = await db
      .update(subcategories)
      .set(data)
      .where(eq(subcategories.id, id))
      .returning();
    return result;
  },

  async deleteSubcategory(id: number) {
    const [result] = await db.delete(subcategories).where(eq(subcategories.id, id)).returning();
    return result;
  },

  // Course operations
  async listCourses(limit: number = 20, offset: number = 0) {
    return await db.query.courses.findMany({
      with: {
        category: true,
        subcategory: true,
      },
      orderBy: [desc(courses.createdAt)],
      limit,
      offset,
    });
  },

  async getCourseById(id: number) {
    return await db.query.courses.findFirst({
      where: eq(courses.id, id),
      with: {
        category: true,
        subcategory: true,
        previewVideo: true,
        lessons: {
          with: {
            video: true,
            videoQuestions: true,
          },
        },
      },
    });
  },

  async createCourse(data: CreateCourseInput) {
    const enrollmentDeadline =
      data.enrollmentDeadline ? new Date(data.enrollmentDeadline) : null;
    const skillLevel = data.skillLevel ?? 'ALL';
    const hasCertificate = data.hasCertificate ?? false;

    const [result] = await db.insert(courses).values({
      ...data,
      price: data.price ? data.price.toString() : null,
      skillLevel,
      hasCertificate,
      enrollmentDeadline,
    }).returning();
    return result;
  },

  async updateCourse(id: number, data: UpdateCourseInput) {
    const enrollmentDeadline =
      data.enrollmentDeadline !== undefined
        ? (data.enrollmentDeadline ? new Date(data.enrollmentDeadline) : null)
        : undefined;
    const skillLevel = data.skillLevel === null ? 'ALL' : data.skillLevel;
    const hasCertificate =
      data.hasCertificate === null ? false : data.hasCertificate;

    const [result] = await db
      .update(courses)
      .set({
        ...data,
        price: data.price ? data.price.toString() : undefined,
        skillLevel,
        hasCertificate,
        enrollmentDeadline,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();
    return result;
  },

  async deleteCourse(id: number) {
    const [result] = await db.delete(courses).where(eq(courses.id, id)).returning();
    return result;
  },
};
