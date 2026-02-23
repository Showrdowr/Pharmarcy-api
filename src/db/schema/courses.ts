import { pgTable, serial, varchar, text, integer, numeric, timestamp, boolean, pgEnum, jsonb, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const courseStatusEnum = pgEnum('course_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const videoProviderEnum = pgEnum('video_provider', ['YOUTUBE', 'VIMEO', 'CLOUDFLARE', 'S3']);
export const questionTypeEnum = pgEnum('question_type', ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']);

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: integer('parent_id'),
});

// Videos table
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  provider: videoProviderEnum('provider').notNull(),
  resourceId: varchar('resource_id', { length: 255 }).notNull(),
  duration: integer('duration'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Courses table
export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  authorName: varchar('author_name', { length: 255 }),
  price: numeric('price', { precision: 10, scale: 2 }),
  thumbnail: text('thumbnail'), // Reverting to text as placeholder or if it's base64. 
  thumbnailMimeType: varchar('thumbnail_mime_type', { length: 255 }),
  previewVideoId: integer('preview_video_id').references(() => videos.id),
  cpeCredits: integer('cpe_credits').default(0),
  conferenceCode: varchar('conference_code', { length: 255 }),
  status: courseStatusEnum('status').notNull().default('DRAFT'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Lessons table
export const lessons = pgTable('lessons', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id),
  videoId: integer('video_id').notNull().references(() => videos.id),
  title: varchar('title', { length: 255 }).notNull(),
  sequenceOrder: integer('sequence_order').notNull(),
});

// Video Questions table
export const videoQuestions = pgTable('video_questions', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull().references(() => lessons.id),
  questionText: text('question_text').notNull(),
  displayAtSeconds: integer('display_at_seconds').notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'),
  correctAnswer: text('correct_answer'),
});

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'subcategories',
  }),
  subcategories: many(categories, { relationName: 'subcategories' }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  previewVideo: one(videos, {
    fields: [courses.previewVideoId],
    references: [videos.id],
  }),
  lessons: many(lessons),
}));

export const videosRelations = relations(videos, ({ many }) => ({
  courses: many(courses), // as preview video
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  video: one(videos, {
    fields: [lessons.videoId],
    references: [videos.id],
  }),
  videoQuestions: many(videoQuestions),
}));

export const videoQuestionsRelations = relations(videoQuestions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [videoQuestions.lessonId],
    references: [lessons.id],
  }),
}));
