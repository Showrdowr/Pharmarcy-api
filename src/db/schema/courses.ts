import { pgTable, serial, varchar, text, integer, numeric, timestamp, boolean, pgEnum, jsonb, customType, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

// Enums
export const courseStatusEnum = pgEnum('course_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const courseAudienceEnum = pgEnum('course_audience', ['all', 'general', 'pharmacist']);
export const videoProviderEnum = pgEnum('video_provider', ['YOUTUBE', 'VIMEO', 'CLOUDFLARE', 'S3']);
export const videoStatusEnum = pgEnum('video_status', ['PROCESSING', 'READY', 'FAILED']);
export const questionTypeEnum = pgEnum('question_type', ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']);

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 50 }),
});

// Subcategories table
export const subcategories = pgTable('subcategories', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 50 }),
});

// Videos table
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  provider: videoProviderEnum('provider').notNull(),
  resourceId: varchar('resource_id', { length: 255 }).notNull(),
  duration: integer('duration'),
  playbackUrl: text('playback_url'),
  status: videoStatusEnum('status').notNull().default('PROCESSING'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Courses table
export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  subcategoryId: integer('subcategory_id').references(() => subcategories.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  details: text('details'),
  authorName: varchar('author_name', { length: 255 }),
  price: numeric('price', { precision: 10, scale: 2 }),
  thumbnail: text('thumbnail'), // DB-backed raw base64 payload for course thumbnails in this phase.
  thumbnailMimeType: varchar('thumbnail_mime_type', { length: 255 }),
  previewVideoId: integer('preview_video_id').references(() => videos.id),
  cpeCredits: numeric('cpe_credits', { precision: 5, scale: 2 }).default('0'),
  conferenceCode: varchar('conference_code', { length: 255 }),
  language: varchar('language', { length: 50 }),
  audience: courseAudienceEnum('audience').notNull().default('all'),
  skillLevel: varchar('skill_level', { length: 50 }).default('ALL'),
  hasCertificate: boolean('has_certificate').default(false),
  maxStudents: integer('max_students'),
  enrollmentDeadline: timestamp('enrollment_deadline', { withTimezone: true }),
  courseEndAt: timestamp('course_end_at', { withTimezone: true }),
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
  description: text('description'),
  sequenceOrder: integer('sequence_order').notNull(),
});

export const lessonDocuments = pgTable('lesson_documents', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  fileUrl: text('file_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const lessonQuizzes = pgTable('lesson_quizzes', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }).unique(),
  passingScorePercent: integer('passing_score_percent').notNull().default(70),
  maxAttempts: integer('max_attempts'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const lessonQuizQuestions = pgTable('lesson_quiz_questions', {
  id: serial('id').primaryKey(),
  lessonQuizId: integer('lesson_quiz_id').notNull().references(() => lessonQuizzes.id, { onDelete: 'cascade' }),
  questionText: text('question_text').notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'),
  correctAnswer: text('correct_answer'),
  scoreWeight: integer('score_weight').notNull().default(1),
});

export const userLessonQuizAttempts = pgTable('user_lesson_quiz_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lessonQuizId: integer('lesson_quiz_id').notNull().references(() => lessonQuizzes.id, { onDelete: 'cascade' }),
  scoreObtained: numeric('score_obtained', { precision: 10, scale: 2 }).notNull().default('0'),
  totalScore: numeric('total_score', { precision: 10, scale: 2 }).notNull().default('0'),
  scorePercent: numeric('score_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  isPassed: boolean('is_passed').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).defaultNow(),
});

export const userLessonQuizAnswers = pgTable('user_lesson_quiz_answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().references(() => userLessonQuizAttempts.id, { onDelete: 'cascade' }),
  lessonQuizQuestionId: integer('lesson_quiz_question_id').notNull().references(() => lessonQuizQuestions.id, { onDelete: 'cascade' }),
  answerGiven: text('answer_given'),
  isCorrect: boolean('is_correct').notNull().default(false),
  pointsEarned: numeric('points_earned', { precision: 10, scale: 2 }).notNull().default('0'),
});

export const courseRelatedCourses = pgTable('course_related_courses', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  relatedCourseId: integer('related_course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({
  courseRelatedUnique: uniqueIndex('course_related_courses_unique_idx').on(table.courseId, table.relatedCourseId),
}));

// Video Questions table
export const videoQuestions = pgTable('video_questions', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull().references(() => lessons.id),
  questionText: text('question_text').notNull(),
  displayAtSeconds: integer('display_at_seconds').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  questionType: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'),
  correctAnswer: text('correct_answer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
  courses: many(courses),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  courses: many(courses),
}));

// Course Tags removal

// Course Tags Junction removal

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [courses.subcategoryId],
    references: [subcategories.id],
  }),
  previewVideo: one(videos, {
    fields: [courses.previewVideoId],
    references: [videos.id],
  }),
  lessons: many(lessons),
  relatedCourseLinks: many(courseRelatedCourses, { relationName: 'sourceCourse' }),
  incomingRelatedCourseLinks: many(courseRelatedCourses, { relationName: 'targetCourse' }),
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
  documents: many(lessonDocuments),
  lessonQuizzes: many(lessonQuizzes),
}));

export const videoQuestionsRelations = relations(videoQuestions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [videoQuestions.lessonId],
    references: [lessons.id],
  }),
}));

export const lessonDocumentsRelations = relations(lessonDocuments, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonDocuments.lessonId],
    references: [lessons.id],
  }),
}));

export const lessonQuizzesRelations = relations(lessonQuizzes, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [lessonQuizzes.lessonId],
    references: [lessons.id],
  }),
  questions: many(lessonQuizQuestions),
  userAttempts: many(userLessonQuizAttempts),
}));

export const lessonQuizQuestionsRelations = relations(lessonQuizQuestions, ({ one, many }) => ({
  lessonQuiz: one(lessonQuizzes, {
    fields: [lessonQuizQuestions.lessonQuizId],
    references: [lessonQuizzes.id],
  }),
  userAnswers: many(userLessonQuizAnswers),
}));

export const userLessonQuizAttemptsRelations = relations(userLessonQuizAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [userLessonQuizAttempts.userId],
    references: [users.id],
  }),
  lessonQuiz: one(lessonQuizzes, {
    fields: [userLessonQuizAttempts.lessonQuizId],
    references: [lessonQuizzes.id],
  }),
  answers: many(userLessonQuizAnswers),
}));

export const userLessonQuizAnswersRelations = relations(userLessonQuizAnswers, ({ one }) => ({
  attempt: one(userLessonQuizAttempts, {
    fields: [userLessonQuizAnswers.attemptId],
    references: [userLessonQuizAttempts.id],
  }),
  question: one(lessonQuizQuestions, {
    fields: [userLessonQuizAnswers.lessonQuizQuestionId],
    references: [lessonQuizQuestions.id],
  }),
}));

export const courseRelatedCoursesRelations = relations(courseRelatedCourses, ({ one }) => ({
  course: one(courses, {
    fields: [courseRelatedCourses.courseId],
    references: [courses.id],
    relationName: 'sourceCourse',
  }),
  relatedCourse: one(courses, {
    fields: [courseRelatedCourses.relatedCourseId],
    references: [courses.id],
    relationName: 'targetCourse',
  }),
}));
