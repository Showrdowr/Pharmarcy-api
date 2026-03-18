import { pgTable, serial, varchar, integer, numeric, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { courses, lessons, videoQuestions } from './courses';

// Enrollments table
export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  courseId: integer('course_id').notNull().references(() => courses.id),
  progressPercent: numeric('progress_percent', { precision: 5, scale: 2 }).default('0.00'),
  isCompleted: boolean('is_completed').default(false),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
});

// Certificates table
export const certificates = pgTable('certificates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  courseId: integer('course_id').notNull().references(() => courses.id),
  certificateCode: varchar('certificate_code', { length: 255 }).notNull().unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow(),
});

// User Lesson Progress table
export const userLessonProgress = pgTable('user_lesson_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  lessonId: integer('lesson_id').notNull().references(() => lessons.id),
  lastWatchedSeconds: integer('last_watched_seconds').default(0),
  isCompleted: boolean('is_completed').default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// User Video Answers table
export const userVideoAnswers = pgTable('user_video_answers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  videoQuestionId: integer('video_question_id').notNull().references(() => videoQuestions.id),
  answerGiven: text('answer_given'), // Added text to imports if missing, but used varchar for simplicity if needed. Docker said text.
  isCorrect: boolean('is_correct'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});



// Relations
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
}));

export const userLessonProgressRelations = relations(userLessonProgress, ({ one }) => ({
  user: one(users, {
    fields: [userLessonProgress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [userLessonProgress.lessonId],
    references: [lessons.id],
  }),
}));

export const userVideoAnswersRelations = relations(userVideoAnswers, ({ one }) => ({
  user: one(users, {
    fields: [userVideoAnswers.userId],
    references: [users.id],
  }),
  videoQuestion: one(videoQuestions, {
    fields: [userVideoAnswers.videoQuestionId],
    references: [videoQuestions.id],
  }),
}));
