process.env.DATABASE_URL ??= 'postgres://tester:tester@127.0.0.1:5432/pharmacy_academy_test';
process.env.JWT_SECRET ??= 'interactive-route-test-secret-value-123';
process.env.JWT_EXPIRES_IN ??= '7d';
process.env.NODE_ENV ??= 'test';
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '3001';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

const serviceMocks = vi.hoisted(() => ({
  getCourseLearning: vi.fn(),
  getLessonQuizRuntime: vi.fn(),
  addVideoQuestionsBulk: vi.fn(),
  answerVideoQuestion: vi.fn(),
  submitLessonQuizAttempt: vi.fn(),
  updateLessonProgress: vi.fn(),
  completeLesson: vi.fn(),
}));

vi.mock('./courses.service.js', () => ({
  coursesService: serviceMocks,
}));

import { errorHandler } from '../../plugins/error-handler.js';
import { registerJwt } from '../../plugins/jwt.js';
import { coursesRoutes } from './courses.routes.js';

async function createTestApp() {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerJwt(app);
  app.setErrorHandler(errorHandler);
  await app.register(coursesRoutes, { prefix: '/api/v1' });
  await app.ready();

  return app;
}

describe('courses learning routes', () => {
  beforeEach(() => {
    serviceMocks.getCourseLearning.mockReset();
    serviceMocks.getLessonQuizRuntime.mockReset();
    serviceMocks.addVideoQuestionsBulk.mockReset();
    serviceMocks.answerVideoQuestion.mockReset();
    serviceMocks.submitLessonQuizAttempt.mockReset();
    serviceMocks.updateLessonProgress.mockReset();
    serviceMocks.completeLesson.mockReset();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('returns the learning payload with video playback contract fields', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.getCourseLearning.mockResolvedValue({
      id: 12,
      title: 'คอร์สตัวอย่าง',
      description: 'คำอธิบายคอร์ส',
      authorName: 'ผู้สอนตัวอย่าง',
      thumbnail: null,
      hasCertificate: false,
      cpeCredits: 0,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: '2026-03-01T00:00:00.000Z',
      progressPercent: 20,
      completedLessons: [],
      lastAccessedLessonId: 1,
      currentLessonId: 1,
      lessons: [
        {
          id: 1,
          title: 'บทเรียนตัวอย่าง',
          sequenceOrder: 1,
          status: 'available',
          video: {
            id: 5,
            provider: 'VIMEO',
            resourceId: '1175386748',
            duration: 600,
            name: 'ProjectPepsi',
            status: 'READY',
            playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
          },
          documents: [],
          interactiveQuestions: [
            {
              id: 77,
              lessonId: 1,
              questionText: 'คำถาม interactive',
              questionType: 'MULTIPLE_CHOICE',
              displayAtSeconds: 120,
              sortOrder: 1,
              options: [{ id: 'a', text: 'คำตอบ A' }],
              answered: false,
            },
          ],
          lessonQuiz: null,
          progress: {
            lastWatchedSeconds: 125,
            isCompleted: false,
          },
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/courses/12/learning',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getCourseLearning).toHaveBeenCalledWith(
      12,
      99,
      expect.objectContaining({ id: 99, role: 'general' }),
    );

    const body = response.json();
    expect(body.data.lessons[0].video).toMatchObject({
      status: 'READY',
      duration: 600,
      playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
    });
    expect(body.data.lessons[0].interactiveQuestions[0]).toMatchObject({
      id: 77,
      answered: false,
      displayAtSeconds: 120,
      sortOrder: 1,
    });
    expect(body.data.lessons[0].progress).toMatchObject({
      lastWatchedSeconds: 125,
      isCompleted: false,
    });

    await app.close();
  });

  it('returns locked lessons as sanitized summaries only', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.getCourseLearning.mockResolvedValue({
      id: 12,
      title: 'คอร์สตัวอย่าง',
      description: 'คำอธิบายคอร์ส',
      authorName: 'ผู้สอนตัวอย่าง',
      thumbnail: null,
      hasCertificate: false,
      cpeCredits: 0,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: '2026-03-01T00:00:00.000Z',
      progressPercent: 20,
      completedLessons: [],
      lastAccessedLessonId: 1,
      currentLessonId: 1,
      lessons: [
        {
          id: 1,
          title: 'บทเรียนตัวอย่าง',
          sequenceOrder: 1,
          status: 'available',
          video: {
            id: 5,
            provider: 'VIMEO',
            resourceId: '1175386748',
            duration: 600,
            name: 'ProjectPepsi',
            status: 'READY',
            playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
          },
          documents: [],
          interactiveQuestions: [],
          lessonQuiz: null,
          progress: {
            lastWatchedSeconds: 125,
            isCompleted: false,
          },
        },
        {
          id: 2,
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
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/courses/12/learning',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.lessons[1]).toEqual({
      id: 2,
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

    await app.close();
  });

  it('submits an interactive answer with the authenticated user id', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.answerVideoQuestion.mockResolvedValue({
      id: 1,
      videoQuestionId: 77,
      answerGiven: 'option-a',
      answered: true,
      updatedAt: '2026-03-21T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/video-questions/77/answer',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        answerGiven: 'option-a',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(serviceMocks.answerVideoQuestion).toHaveBeenCalledWith(
      77,
      99,
      {
        answerGiven: 'option-a',
      },
      expect.objectContaining({ id: 99, role: 'general' }),
    );
    expect(response.json().data).toMatchObject({
      videoQuestionId: 77,
      answerGiven: 'option-a',
      answered: true,
    });

    await app.close();
  });

  it('returns lesson quiz runtime for the authenticated learner', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.getLessonQuizRuntime.mockResolvedValue({
      id: 44,
      lessonId: 1,
      passingScorePercent: 70,
      maxAttempts: 3,
      attemptsUsed: 1,
      remainingAttempts: 2,
      latestAttempt: {
        id: 8,
        attemptNumber: 1,
        scorePercent: 80,
        isPassed: true,
      },
      questions: [
        {
          id: 401,
          questionText: 'คำถามท้ายบท',
          questionType: 'MULTIPLE_CHOICE',
          options: [{ id: 'option-a', text: 'คำตอบ A' }],
          scoreWeight: 1,
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/lessons/1/quiz-runtime',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.getLessonQuizRuntime).toHaveBeenCalledWith(
      1,
      99,
      expect.objectContaining({ id: 99, role: 'general' }),
    );
    expect(response.json().data).toMatchObject({
      lessonId: 1,
      attemptsUsed: 1,
      questions: [
        expect.objectContaining({
          id: 401,
          questionType: 'MULTIPLE_CHOICE',
        }),
      ],
    });

    await app.close();
  });

  it('submits a lesson quiz attempt with the authenticated learner id', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.submitLessonQuizAttempt.mockResolvedValue({
      attemptId: 12,
      lessonId: 1,
      quizId: 44,
      attemptNumber: 2,
      attemptsUsed: 2,
      scorePercent: 90,
      isPassed: true,
      answers: [
        {
          questionId: 401,
          answerGiven: 'option-a',
          isCorrect: true,
          pointsEarned: 1,
        },
      ],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons/1/quiz-attempts',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        answers: [
          { questionId: 401, answerGiven: 'option-a' },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(serviceMocks.submitLessonQuizAttempt).toHaveBeenCalledWith(
      1,
      99,
      {
        answers: [
          { questionId: 401, answerGiven: 'option-a' },
        ],
      },
      expect.objectContaining({ id: 99, role: 'general' }),
    );
    expect(response.json().data).toMatchObject({
      lessonId: 1,
      quizId: 44,
      isPassed: true,
    });

    await app.close();
  });

  it('returns LESSON_LOCKED when an interactive answer targets a locked lesson', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.answerVideoQuestion.mockRejectedValue(
      Object.assign(new Error('กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน'), {
        statusCode: 409,
        code: 'LESSON_LOCKED',
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/video-questions/77/answer',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        answerGiven: 'option-a',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_LOCKED',
      message: 'กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน',
    });

    await app.close();
  });

  it('allows admins to bulk import interactive questions in a single request', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 7, role: 'admin', isAdmin: true });

    serviceMocks.addVideoQuestionsBulk.mockResolvedValue([
      {
        id: 1,
        lessonId: 55,
        questionText: 'คำถามข้อ 1',
        displayAtSeconds: 120,
        sortOrder: 0,
        questionType: 'MULTIPLE_CHOICE',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
      },
    ]);

    const payload = {
      questions: [
        {
          questionText: 'คำถามข้อ 1',
          displayAtSeconds: 120,
          sortOrder: 0,
          questionType: 'MULTIPLE_CHOICE',
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
        },
      ],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lessons/55/video-questions/bulk',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(serviceMocks.addVideoQuestionsBulk).toHaveBeenCalledWith(55, payload);
    expect(response.json().data).toHaveLength(1);

    await app.close();
  });

  it('updates lesson progress through the protected learning route', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.updateLessonProgress.mockResolvedValue({
      lastWatchedSeconds: 180,
      isCompleted: false,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/lessons/1/progress',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        lastWatchedSeconds: 180,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(serviceMocks.updateLessonProgress).toHaveBeenCalledWith(
      1,
      99,
      {
        lastWatchedSeconds: 180,
      },
      expect.objectContaining({ id: 99, role: 'general' }),
    );
    expect(response.json().data).toEqual({
      lastWatchedSeconds: 180,
      isCompleted: false,
    });

    await app.close();
  });

  it('returns LESSON_LOCKED when lesson progress targets a locked lesson', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.updateLessonProgress.mockRejectedValue(
      Object.assign(new Error('กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน'), {
        statusCode: 409,
        code: 'LESSON_LOCKED',
      }),
    );

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/lessons/2/progress',
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
      message: 'กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน',
    });

    await app.close();
  });

  it('returns INTERACTIVE_INCOMPLETE when lesson completion is blocked by pending questions', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.completeLesson.mockRejectedValue(
      Object.assign(new Error('กรุณาตอบคำถาม interactive ให้ครบก่อนจบบทเรียน'), {
        statusCode: 409,
        code: 'INTERACTIVE_INCOMPLETE',
      })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/12/lessons/1/complete',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(serviceMocks.completeLesson).toHaveBeenCalledWith(
      12,
      1,
      99,
      expect.objectContaining({ id: 99, role: 'general' }),
    );
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'INTERACTIVE_INCOMPLETE',
      message: 'กรุณาตอบคำถาม interactive ให้ครบก่อนจบบทเรียน',
    });

    await app.close();
  });

  it('returns LESSON_LOCKED when lesson completion targets a locked lesson', async () => {
    const app = await createTestApp();
    const token = app.jwt.sign({ id: 99, role: 'general' });

    serviceMocks.completeLesson.mockRejectedValue(
      Object.assign(new Error('กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน'), {
        statusCode: 409,
        code: 'LESSON_LOCKED',
      }),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/courses/12/lessons/2/complete',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      statusCode: 409,
      code: 'LESSON_LOCKED',
      message: 'กรุณาเรียนบทก่อนหน้าให้เสร็จก่อน',
    });

    await app.close();
  });
});
