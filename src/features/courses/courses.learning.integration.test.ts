process.env.JWT_SECRET ??= 'interactive-integration-secret-value-123456';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';
process.env.LOG_LEVEL ??= 'fatal';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import {
  courses,
  enrollments,
  lessonDocuments,
  lessonQuizQuestions,
  lessonQuizzes,
  lessons,
  userLessonProgress,
  userVideoAnswers,
  videoQuestions,
  videos,
  users,
} from '../../db/schema/index.js';

type SeededLearningFixture = {
  userId: number;
  courseId: number;
  enrollmentId: number;
  availableLessonId: number;
  lockedLessonId: number;
  availableQuestionId: number;
  lockedQuestionId: number;
  initialLastAccessedAt: Date;
  insertedIds: {
    answerIds: number[];
    progressIds: number[];
    lessonDocumentIds: number[];
    lessonQuizQuestionIds: number[];
    lessonQuizIds: number[];
    videoQuestionIds: number[];
    enrollmentIds: number[];
    lessonIds: number[];
    courseIds: number[];
    videoIds: number[];
    userIds: number[];
  };
};

let app: FastifyInstance;
let fixtureCounter = 0;
const createdFixtures: SeededLearningFixture[] = [];

async function ensureEnrollmentLearningStateColumns() {
  await db.execute(sql`
    ALTER TABLE "enrollments"
    ADD COLUMN IF NOT EXISTS "watch_percent" numeric(5, 2) DEFAULT '0.00'
  `);

  await db.execute(sql`
    ALTER TABLE "enrollments"
    ADD COLUMN IF NOT EXISTS "last_accessed_lesson_id" integer
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'enrollments_last_accessed_lesson_id_lessons_id_fk'
      ) THEN
        ALTER TABLE "enrollments"
        ADD CONSTRAINT "enrollments_last_accessed_lesson_id_lessons_id_fk"
        FOREIGN KEY ("last_accessed_lesson_id")
        REFERENCES "lessons"("id")
        ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);
}

function createSuffix() {
  fixtureCounter += 1;
  return `${Date.now()}-${fixtureCounter}`;
}

function createLearnerToken(userId: number) {
  return app.jwt.sign({ id: userId, role: 'member' });
}

function createAdminToken() {
  return app.jwt.sign({ id: 9000, role: 'admin', isAdmin: true });
}

async function cleanupFixture(fixture: SeededLearningFixture) {
  const { insertedIds } = fixture;
  const lessonIds = insertedIds.lessonIds;

  await db.delete(userVideoAnswers).where(eq(userVideoAnswers.userId, fixture.userId));
  await db.delete(userLessonProgress).where(eq(userLessonProgress.userId, fixture.userId));

  if (insertedIds.lessonQuizIds.length > 0) {
    await db.delete(lessonQuizQuestions).where(inArray(lessonQuizQuestions.lessonQuizId, insertedIds.lessonQuizIds));
  }

  if (lessonIds.length > 0) {
    await db.delete(lessonQuizzes).where(inArray(lessonQuizzes.lessonId, lessonIds));
  }

  if (lessonIds.length > 0) {
    await db.delete(lessonDocuments).where(inArray(lessonDocuments.lessonId, lessonIds));
  }

  if (lessonIds.length > 0) {
    await db.delete(videoQuestions).where(inArray(videoQuestions.lessonId, lessonIds));
  }

  await db.delete(enrollments).where(and(
    eq(enrollments.userId, fixture.userId),
    eq(enrollments.courseId, fixture.courseId),
  ));

  if (insertedIds.lessonIds.length > 0) {
    await db.delete(lessons).where(inArray(lessons.id, insertedIds.lessonIds));
  }

  if (insertedIds.courseIds.length > 0) {
    await db.delete(courses).where(inArray(courses.id, insertedIds.courseIds));
  }

  if (insertedIds.videoIds.length > 0) {
    await db.delete(videos).where(inArray(videos.id, insertedIds.videoIds));
  }

  if (insertedIds.userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, insertedIds.userIds));
  }
}

async function seedLearningFixture() {
  const suffix = createSuffix();
  const initialLastAccessedAt = new Date('2026-03-21T00:00:00.000Z');

  const insertedIds: SeededLearningFixture['insertedIds'] = {
    answerIds: [],
    progressIds: [],
    lessonDocumentIds: [],
    lessonQuizQuestionIds: [],
    lessonQuizIds: [],
    videoQuestionIds: [],
    enrollmentIds: [],
    lessonIds: [],
    courseIds: [],
    videoIds: [],
    userIds: [],
  };

  const [user] = await db.insert(users).values({
    fullName: `Integration Learner ${suffix}`,
    email: `integration-learner-${suffix}@example.com`,
    passwordHash: 'hashed-password-for-tests',
    role: 'member',
  }).returning();
  insertedIds.userIds.push(user.id);

  const [availableVideo] = await db.insert(videos).values({
    name: `Integration Available Video ${suffix}`,
    provider: 'VIMEO',
    resourceId: `integration-available-${suffix}`,
    duration: 600,
    playbackUrl: `https://player.vimeo.com/video/1175386748?h=available-${suffix}`,
    status: 'READY',
  }).returning();
  insertedIds.videoIds.push(availableVideo.id);

  const [lockedVideo] = await db.insert(videos).values({
    name: `Integration Locked Video ${suffix}`,
    provider: 'VIMEO',
    resourceId: `integration-locked-${suffix}`,
    duration: 480,
    playbackUrl: `https://player.vimeo.com/video/1175386750?h=locked-${suffix}`,
    status: 'READY',
  }).returning();
  insertedIds.videoIds.push(lockedVideo.id);

  const [course] = await db.insert(courses).values({
    title: `Integration Course ${suffix}`,
    description: 'Course for DB-backed learning integration tests',
    details: 'Detailed description for integration coverage',
    authorName: 'Integration Teacher',
    previewVideoId: availableVideo.id,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-03-20T00:00:00.000Z'),
    hasCertificate: false,
    cpeCredits: 2,
  }).returning();
  insertedIds.courseIds.push(course.id);

  const [availableLesson] = await db.insert(lessons).values({
    courseId: course.id,
    videoId: availableVideo.id,
    title: 'บทเรียนที่พร้อมเรียน',
    sequenceOrder: 1,
  }).returning();
  insertedIds.lessonIds.push(availableLesson.id);

  const [lockedLesson] = await db.insert(lessons).values({
    courseId: course.id,
    videoId: lockedVideo.id,
    title: 'บทเรียนที่ยังล็อก',
    sequenceOrder: 2,
  }).returning();
  insertedIds.lessonIds.push(lockedLesson.id);

  const [lockedDocument] = await db.insert(lessonDocuments).values({
    lessonId: lockedLesson.id,
    fileName: 'locked-lesson.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    fileUrl: `https://example.com/locked-${suffix}.pdf`,
  }).returning();
  insertedIds.lessonDocumentIds.push(lockedDocument.id);

  const [lockedQuiz] = await db.insert(lessonQuizzes).values({
    lessonId: lockedLesson.id,
    passingScorePercent: 80,
    maxAttempts: 3,
  }).returning();
  insertedIds.lessonQuizIds.push(lockedQuiz.id);

  const [lockedQuizQuestion] = await db.insert(lessonQuizQuestions).values({
    lessonQuizId: lockedQuiz.id,
    questionText: 'คำถามของบทล็อก',
    questionType: 'TRUE_FALSE',
    options: [
      { id: 'true', text: 'จริง' },
      { id: 'false', text: 'เท็จ' },
    ],
    correctAnswer: 'true',
    scoreWeight: 1,
  }).returning();
  insertedIds.lessonQuizQuestionIds.push(lockedQuizQuestion.id);

  const [availableQuestion] = await db.insert(videoQuestions).values({
    lessonId: availableLesson.id,
    questionText: 'คำถามของบทที่พร้อมเรียน',
    displayAtSeconds: 120,
    sortOrder: 0,
    questionType: 'MULTIPLE_CHOICE',
    options: [
      { id: 'option-a', text: 'ตัวเลือก A' },
      { id: 'option-b', text: 'ตัวเลือก B' },
    ],
    correctAnswer: null,
  }).returning();
  insertedIds.videoQuestionIds.push(availableQuestion.id);

  const [lockedQuestion] = await db.insert(videoQuestions).values({
    lessonId: lockedLesson.id,
    questionText: 'คำถามของบทที่ยังล็อก',
    displayAtSeconds: 60,
    sortOrder: 0,
    questionType: 'TRUE_FALSE',
    options: [
      { id: 'true', text: 'จริง' },
      { id: 'false', text: 'เท็จ' },
    ],
    correctAnswer: null,
  }).returning();
  insertedIds.videoQuestionIds.push(lockedQuestion.id);

  const [enrollment] = await db.insert(enrollments).values({
    userId: user.id,
    courseId: course.id,
    progressPercent: '0.00',
    isCompleted: false,
    lastAccessedAt: initialLastAccessedAt,
  }).returning();
  insertedIds.enrollmentIds.push(enrollment.id);

  const fixture: SeededLearningFixture = {
    userId: user.id,
    courseId: course.id,
    enrollmentId: enrollment.id,
    availableLessonId: availableLesson.id,
    lockedLessonId: lockedLesson.id,
    availableQuestionId: availableQuestion.id,
    lockedQuestionId: lockedQuestion.id,
    initialLastAccessedAt,
    insertedIds,
  };

  createdFixtures.push(fixture);
  return fixture;
}

describe.sequential('courses learning integration', () => {
  beforeAll(async () => {
    await ensureEnrollmentLearningStateColumns();
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    while (createdFixtures.length > 0) {
      const fixture = createdFixtures.pop();
      if (fixture) {
        await cleanupFixture(fixture);
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanitizes locked lessons in the real learning payload and keeps currentLessonId on the first unlocked lesson', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${fixture.courseId}/learning`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const lockedLesson = body.data.lessons.find((lesson: { id: number }) => lesson.id === fixture.lockedLessonId);

    expect(body.data.currentLessonId).toBe(fixture.availableLessonId);
    expect(lockedLesson).toEqual({
      id: fixture.lockedLessonId,
      title: 'บทเรียนที่ยังล็อก',
      sequenceOrder: 2,
      status: 'locked',
      video: null,
      documents: [],
      interactiveQuestions: [],
      lessonQuiz: null,
      progress: {
        lastWatchedSeconds: 0,
        isCompleted: false,
      },
    });
  });

  it('returns LESSON_LOCKED when answering an interactive question from a locked lesson', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/video-questions/${fixture.lockedQuestionId}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        answerGiven: 'true',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_LOCKED',
    });
  });

  it('returns LESSON_LOCKED when updating progress for a locked lesson', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${fixture.lockedLessonId}/progress`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        lastWatchedSeconds: 120,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_LOCKED',
    });
  });

  it('returns LESSON_LOCKED when completing a locked lesson', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${fixture.courseId}/lessons/${fixture.lockedLessonId}/complete`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_LOCKED',
    });
  });

  it('keeps lesson progress monotonic even when a lower timestamp arrives later', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const firstResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${fixture.availableLessonId}/progress`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        lastWatchedSeconds: 30,
      },
    });

    const secondResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${fixture.availableLessonId}/progress`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        lastWatchedSeconds: 25,
      },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json().data.lastWatchedSeconds).toBe(30);
    expect(secondResponse.json().data.lastWatchedSeconds).toBe(30);

    const [progressRow] = await db
      .select()
      .from(userLessonProgress)
      .where(eq(userLessonProgress.lessonId, fixture.availableLessonId));

    expect(progressRow?.lastWatchedSeconds).toBe(30);
  });

  it('rejects progress updates that jump too far ahead of the watched position', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lessons/${fixture.availableLessonId}/progress`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        lastWatchedSeconds: 120,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'VIDEO_SKIP_NOT_ALLOWED',
      message: 'ไม่สามารถข้ามวิดีโอไปข้างหน้าได้ กรุณาเรียนตามลำดับเวลา',
    });

    const progressRows = await db
      .select()
      .from(userLessonProgress)
      .where(eq(userLessonProgress.lessonId, fixture.availableLessonId));

    expect(progressRows).toHaveLength(0);
  });

  it('requires the learner to watch the video to the end before completing the lesson', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    await db.insert(userLessonProgress).values({
      userId: fixture.userId,
      lessonId: fixture.availableLessonId,
      lastWatchedSeconds: 599,
      isCompleted: false,
    });

    const incompleteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${fixture.courseId}/lessons/${fixture.availableLessonId}/complete`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(incompleteResponse.statusCode).toBe(409);
    expect(incompleteResponse.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_VIDEO_INCOMPLETE',
      message: 'ต้องดูวิดีโอให้จบก่อนจบบทเรียน',
    });
  });

  it('does not touch enrollment on GET /learning but does update lastAccessedAt on a write path', async () => {
    const fixture = await seedLearningFixture();
    const token = createLearnerToken(fixture.userId);

    const readResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/courses/${fixture.courseId}/learning`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(readResponse.statusCode).toBe(200);

    const [afterReadEnrollment] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, fixture.enrollmentId));

    expect(afterReadEnrollment?.lastAccessedAt?.toISOString()).toBe(fixture.initialLastAccessedAt.toISOString());

    const answerResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/video-questions/${fixture.availableQuestionId}/answer`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        answerGiven: 'option-a',
      },
    });

    expect(answerResponse.statusCode).toBe(201);

    const [afterWriteEnrollment] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, fixture.enrollmentId));

    expect(afterWriteEnrollment?.lastAccessedAt).not.toBeNull();
    expect(afterWriteEnrollment?.lastAccessedAt?.getTime()).toBeGreaterThan(fixture.initialLastAccessedAt.getTime());
  });

  it('bulk imports interactive questions atomically when the batch is valid', async () => {
    const fixture = await seedLearningFixture();
    const token = createAdminToken();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${fixture.availableLessonId}/video-questions/bulk`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        questions: [
          {
            questionText: 'คำถามจาก bulk ชุดที่ 1',
            displayAtSeconds: 210,
            questionType: 'MULTIPLE_CHOICE',
            options: [
              { id: 'bulk-a', text: 'ตัวเลือก A' },
              { id: 'bulk-b', text: 'ตัวเลือก B' },
            ],
          },
          {
            questionText: 'คำถามจาก bulk ชุดที่ 2',
            displayAtSeconds: 240,
            questionType: 'SHORT_ANSWER',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toHaveLength(2);

    const importedRows = await db
      .select()
      .from(videoQuestions)
      .where(eq(videoQuestions.lessonId, fixture.availableLessonId));

    expect(importedRows).toHaveLength(3);
    expect(importedRows
      .filter((row) => row.questionText.startsWith('คำถามจาก bulk'))
      .map((row) => row.sortOrder)
      .sort((left, right) => left - right)).toEqual([1, 2]);
  });

  it('rolls back a bulk import when one question in the batch fails validation', async () => {
    const fixture = await seedLearningFixture();
    const token = createAdminToken();
    const [beforeCountRow] = await db
      .select({ count: count(videoQuestions.id) })
      .from(videoQuestions)
      .where(eq(videoQuestions.lessonId, fixture.availableLessonId));

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${fixture.availableLessonId}/video-questions/bulk`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        questions: [
          {
            questionText: 'คำถาม valid ที่ไม่ควรถูกสร้างบางส่วน',
            displayAtSeconds: 200,
            questionType: 'MULTIPLE_CHOICE',
            options: [
              { id: 'valid-a', text: 'ตัวเลือก A' },
              { id: 'valid-b', text: 'ตัวเลือก B' },
            ],
          },
          {
            questionText: 'คำถาม invalid เกินความยาววิดีโอ',
            displayAtSeconds: 601,
            questionType: 'SHORT_ANSWER',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      message: 'เวลาที่แสดงคำถามต้องไม่เกินความยาววิดีโอ',
    });

    const [afterCountRow] = await db
      .select({ count: count(videoQuestions.id) })
      .from(videoQuestions)
      .where(eq(videoQuestions.lessonId, fixture.availableLessonId));

    expect(afterCountRow?.count).toBe(beforeCountRow?.count);
  });
});
