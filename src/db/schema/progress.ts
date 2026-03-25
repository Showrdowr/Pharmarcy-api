import { pgTable, serial, varchar, integer, numeric, timestamp, boolean, text, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { courses, lessons, videoQuestions } from './courses.js';
import { orderItems } from './orders.js';

export const enrollmentStatusEnum = pgEnum('enrollment_status', ['ACTIVE', 'CANCELLED', 'REFUND_PENDING']);
export const courseRefundRequestStatusEnum = pgEnum('course_refund_request_status', ['PENDING', 'APPROVED', 'REJECTED']);

// Enrollments table
export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  courseId: integer('course_id').notNull().references(() => courses.id),
  status: enrollmentStatusEnum('status').notNull().default('ACTIVE'),
  progressPercent: numeric('progress_percent', { precision: 5, scale: 2 }).default('0.00'),
  watchPercent: numeric('watch_percent', { precision: 5, scale: 2 }).default('0.00'),
  isCompleted: boolean('is_completed').default(false),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  lastAccessedLessonId: integer('last_accessed_lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  sourceOrderItemId: integer('source_order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
}, (table) => ({
  enrollmentsUserCourseUnique: uniqueIndex('enrollments_user_course_unique_idx').on(table.userId, table.courseId),
}));

export const courseRefundRequests = pgTable('course_refund_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  enrollmentId: integer('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
  orderItemId: integer('order_item_id').references(() => orderItems.id, { onDelete: 'set null' }),
  status: courseRefundRequestStatusEnum('status').notNull().default('PENDING'),
  reason: text('reason'),
  adminNote: text('admin_note'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedByAdminId: varchar('resolved_by_admin_id', { length: 255 }),
}, (table) => ({
  refundRequestEnrollmentUnique: uniqueIndex('course_refund_requests_enrollment_unique_idx').on(table.enrollmentId),
}));

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
}, (table) => ({
  userLessonProgressUserLessonUnique: uniqueIndex('user_lesson_progress_user_lesson_unique_idx').on(table.userId, table.lessonId),
}));

// User Video Answers table
export const userVideoAnswers = pgTable('user_video_answers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  videoQuestionId: integer('video_question_id').notNull().references(() => videoQuestions.id),
  answerGiven: text('answer_given'),
  isCorrect: boolean('is_correct'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userVideoAnswersUserQuestionUnique: uniqueIndex('user_video_answers_user_question_unique_idx').on(table.userId, table.videoQuestionId),
}));

export const courseReviews = pgTable('course_reviews', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255, notNull: false }),
  body: text('body', { notNull: false }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  courseReviewsUnique: uniqueIndex('course_reviews_unique_idx').on(table.courseId, table.userId),
}));



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
  lastAccessedLesson: one(lessons, {
    fields: [enrollments.lastAccessedLessonId],
    references: [lessons.id],
  }),
}));

export const courseRefundRequestsRelations = relations(courseRefundRequests, ({ one }) => ({
  user: one(users, {
    fields: [courseRefundRequests.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseRefundRequests.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [courseRefundRequests.enrollmentId],
    references: [enrollments.id],
  }),
  orderItem: one(orderItems, {
    fields: [courseRefundRequests.orderItemId],
    references: [orderItems.id],
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

export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  user: one(users, {
    fields: [courseReviews.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
}));
