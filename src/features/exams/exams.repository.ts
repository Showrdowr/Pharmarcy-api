import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { exams, examQuestions } from '../../db/schema/exams.js';
import type { CreateExamInput, UpdateExamInput, CreateExamQuestionInput, UpdateExamQuestionInput } from './exams.schema.js';

export const examsRepository = {
  async getByCourseId(courseId: number) {
    const result = await db
      .select()
      .from(exams)
      .where(eq(exams.courseId, courseId))
      .limit(1);

    const exam = result[0] || null;
    if (!exam) return null;

    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));

    return { ...exam, questions };
  },

  async getById(id: number) {
    const result = await db
      .select()
      .from(exams)
      .where(eq(exams.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(courseId: number, data: CreateExamInput) {
    const result = await db
      .insert(exams)
      .values({
        courseId,
        title: data.title,
        description: data.description ?? null,
        passingScorePercent: data.passingScorePercent,
        timeLimitMinutes: data.timeLimitMinutes ?? null,
      })
      .returning();
    return { ...result[0], questions: [] };
  },

  async update(id: number, data: UpdateExamInput) {
    const values: Record<string, any> = {};
    if (data.title !== undefined) values.title = data.title;
    if (data.description !== undefined) values.description = data.description;
    if (data.passingScorePercent !== undefined) values.passingScorePercent = data.passingScorePercent;
    if (data.timeLimitMinutes !== undefined) values.timeLimitMinutes = data.timeLimitMinutes;

    if (Object.keys(values).length === 0) return this.getById(id);

    const result = await db
      .update(exams)
      .set(values)
      .where(eq(exams.id, id))
      .returning();
    return result[0] || null;
  },

  async delete(id: number) {
    // Delete questions first
    await db.delete(examQuestions).where(eq(examQuestions.examId, id));
    // Delete exam
    await db.delete(exams).where(eq(exams.id, id));
  },

  // Exam Questions
  async addQuestion(examId: number, data: CreateExamQuestionInput) {
    const result = await db
      .insert(examQuestions)
      .values({
        examId,
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options ?? null,
        scoreWeight: data.scoreWeight,
        correctAnswer: data.correctAnswer ?? null,
      })
      .returning();
    return result[0];
  },

  async updateQuestion(questionId: number, data: UpdateExamQuestionInput) {
    const values: Record<string, any> = {};
    if (data.questionText !== undefined) values.questionText = data.questionText;
    if (data.questionType !== undefined) values.questionType = data.questionType;
    if (data.options !== undefined) values.options = data.options;
    if (data.scoreWeight !== undefined) values.scoreWeight = data.scoreWeight;
    if (data.correctAnswer !== undefined) values.correctAnswer = data.correctAnswer;

    if (Object.keys(values).length === 0) return null;

    const result = await db
      .update(examQuestions)
      .set(values)
      .where(eq(examQuestions.id, questionId))
      .returning();
    return result[0] || null;
  },

  async deleteQuestion(questionId: number) {
    await db.delete(examQuestions).where(eq(examQuestions.id, questionId));
  },
};
