import { pgTable, serial, varchar, text, integer, numeric, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { courses, questionTypeEnum } from './courses';

// Exams table
export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  passingScorePercent: integer('passing_score_percent').notNull(),
  timeLimitMinutes: integer('time_limit_minutes'),
});

// Exam Questions table
export const examQuestions = pgTable('exam_questions', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id').notNull().references(() => exams.id),
  questionText: text('question_text').notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'),
  scoreWeight: integer('score_weight').notNull(),
  correctAnswer: text('correct_answer'),
});

// User Exam Attempts table
export const userExamAttempts = pgTable('user_exam_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  examId: integer('exam_id').notNull().references(() => exams.id),
  scoreObtained: numeric('score_obtained', { precision: 10, scale: 2 }),
  totalScore: numeric('total_score', { precision: 10, scale: 2 }),
  isPassed: boolean('is_passed'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

// User Exam Answers table
export const userExamAnswers = pgTable('user_exam_answers', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id').notNull().references(() => userExamAttempts.id),
  examQuestionId: integer('exam_question_id').notNull().references(() => examQuestions.id),
  isCorrect: boolean('is_correct'),
  pointsEarned: numeric('points_earned', { precision: 10, scale: 2 }),
});

// Relations
export const examsRelations = relations(exams, ({ one, many }) => ({
  course: one(courses, {
    fields: [exams.courseId],
    references: [courses.id],
  }),
  questions: many(examQuestions),
  userAttempts: many(userExamAttempts),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examQuestions.examId],
    references: [exams.id],
  }),
  userAnswers: many(userExamAnswers),
}));

export const userExamAttemptsRelations = relations(userExamAttempts, ({ one, many }) => ({
  user: one(users, {
    fields: [userExamAttempts.userId],
    references: [users.id],
  }),
  exam: one(exams, {
    fields: [userExamAttempts.examId],
    references: [exams.id],
  }),
  answers: many(userExamAnswers),
}));

export const userExamAnswersRelations = relations(userExamAnswers, ({ one }) => ({
  attempt: one(userExamAttempts, {
    fields: [userExamAnswers.attemptId],
    references: [userExamAttempts.id],
  }),
  question: one(examQuestions, {
    fields: [userExamAnswers.examQuestionId],
    references: [examQuestions.id],
  }),
}));
