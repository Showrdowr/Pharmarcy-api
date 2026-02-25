import { z } from 'zod';

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
  authorName: z.string().max(255).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  thumbnailMimeType: z.string().max(255).optional().nullable(),
  previewVideoId: z.number().optional().nullable(),
  cpeCredits: z.number().min(0).optional().nullable(),
  conferenceCode: z.string().max(255).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export const updateCourseSchema = createCourseSchema.partial();

export const categoryParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
