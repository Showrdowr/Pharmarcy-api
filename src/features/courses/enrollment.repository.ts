import { db } from '../../db/index.js';
import { enrollments, userLessonProgress } from '../../db/schema/index.js';
import { courses, lessons, categories } from '../../db/schema/index.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';

export const enrollmentRepository = {
  async findByUserAndCourse(userId: number, courseId: number) {
    return await db.query.enrollments.findFirst({
      where: and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId)
      ),
    });
  },

  async enroll(userId: number, courseId: number) {
    const [result] = await db.insert(enrollments).values({
      userId,
      courseId,
      progressPercent: '0.00',
      isCompleted: false,
    }).returning();
    return result;
  },

  async getEnrolledCourses(userId: number) {
    return await db.query.enrollments.findMany({
      where: eq(enrollments.userId, userId),
      with: {
        course: {
          with: {
            category: true,
            lessons: true,
          },
        },
      },
      orderBy: [desc(enrollments.enrolledAt)],
    });
  },

  async updateProgress(userId: number, courseId: number, progressPercent: string, isCompleted: boolean) {
    const [result] = await db
      .update(enrollments)
      .set({
        progressPercent,
        isCompleted,
        lastAccessedAt: new Date(),
      })
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, courseId)
        )
      )
      .returning();
    return result;
  },

  async getLessonProgress(userId: number, lessonId: number) {
    return await db.query.userLessonProgress.findFirst({
      where: and(
        eq(userLessonProgress.userId, userId),
        eq(userLessonProgress.lessonId, lessonId)
      ),
    });
  },

  async markLessonComplete(userId: number, lessonId: number) {
    const existing = await this.getLessonProgress(userId, lessonId);
    if (existing) {
      const [result] = await db
        .update(userLessonProgress)
        .set({ isCompleted: true, updatedAt: new Date() })
        .where(eq(userLessonProgress.id, existing.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(userLessonProgress).values({
      userId,
      lessonId,
      isCompleted: true,
    }).returning();
    return result;
  },

  async getCompletedLessonsCount(userId: number, courseId: number) {
    const result = await db
      .select({ count: count() })
      .from(userLessonProgress)
      .innerJoin(lessons, eq(userLessonProgress.lessonId, lessons.id))
      .where(
        and(
          eq(userLessonProgress.userId, userId),
          eq(lessons.courseId, courseId),
          eq(userLessonProgress.isCompleted, true)
        )
      );
    return result[0]?.count ?? 0;
  },

  async getTotalLessonsCount(courseId: number) {
    const result = await db
      .select({ count: count() })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));
    return result[0]?.count ?? 0;
  },

  async getUserLessonProgressForCourse(userId: number, courseId: number) {
    return await db
      .select({
        lessonId: userLessonProgress.lessonId,
        isCompleted: userLessonProgress.isCompleted,
        lastWatchedSeconds: userLessonProgress.lastWatchedSeconds,
      })
      .from(userLessonProgress)
      .innerJoin(lessons, eq(userLessonProgress.lessonId, lessons.id))
      .where(
        and(
          eq(userLessonProgress.userId, userId),
          eq(lessons.courseId, courseId)
        )
      );
  },

  async getEnrollmentCount(courseId: number) {
    const result = await db
      .select({ count: count() })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));
    return result[0]?.count ?? 0;
  },

  async getFeaturedCourses(limit: number = 6) {
    return await db.query.courses.findMany({
      where: eq(courses.status, 'PUBLISHED'),
      with: {
        category: true,
        lessons: true,
      },
      orderBy: [desc(courses.publishedAt)],
      limit,
    });
  },

  async getPopularCourses(limit: number = 8) {
    // Popular = most enrollments
    const result = await db
      .select({
        courseId: enrollments.courseId,
        enrollCount: count(),
      })
      .from(enrollments)
      .groupBy(enrollments.courseId)
      .orderBy(desc(count()))
      .limit(limit);

    if (result.length === 0) {
      // Fallback: return latest published courses
      return await db.query.courses.findMany({
        where: eq(courses.status, 'PUBLISHED'),
        with: { category: true, lessons: true },
        orderBy: [desc(courses.createdAt)],
        limit,
      });
    }

    const courseIds = result.map(r => r.courseId);
    const coursesData = await Promise.all(
      courseIds.map(id =>
        db.query.courses.findFirst({
          where: eq(courses.id, id),
          with: { category: true, lessons: true },
        })
      )
    );

    return coursesData.filter(Boolean);
  },

  async getTotalEnrollments() {
    const result = await db.select({ count: count() }).from(enrollments);
    return result[0]?.count ?? 0;
  },
};
