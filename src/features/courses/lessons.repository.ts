import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { lessons, videoQuestions } from '../../db/schema/courses.js';
import type { CreateLessonInput, UpdateLessonInput } from './courses.schema.js';

export const lessonsRepository = {
  async listByCourseId(courseId: number) {
    return db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.sequenceOrder));
  },

  async getById(id: number) {
    const result = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(courseId: number, data: CreateLessonInput) {
    const result = await db
      .insert(lessons)
      .values({
        courseId,
        title: data.title,
        videoId: data.videoId ?? null,
        sequenceOrder: data.sequenceOrder,
      })
      .returning();
    return result[0];
  },

  async update(id: number, data: UpdateLessonInput) {
    const values: Record<string, any> = {};
    if (data.title !== undefined) values.title = data.title;
    if (data.videoId !== undefined) values.videoId = data.videoId;
    if (data.sequenceOrder !== undefined) values.sequenceOrder = data.sequenceOrder;

    if (Object.keys(values).length === 0) return this.getById(id);

    const result = await db
      .update(lessons)
      .set(values)
      .where(eq(lessons.id, id))
      .returning();
    return result[0] || null;
  },

  async delete(id: number) {
    // Delete video questions first
    await db.delete(videoQuestions).where(eq(videoQuestions.lessonId, id));
    // Delete lesson
    await db.delete(lessons).where(eq(lessons.id, id));
  },
};
