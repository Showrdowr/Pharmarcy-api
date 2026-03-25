import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  transaction: vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({ kind: 'tx' })),
}));

const repositoryMocks = vi.hoisted(() => ({
  getCourseForLearner: vi.fn(),
  findEnrollment: vi.fn(),
  listUserLessonProgress: vi.fn(),
  listUserVideoAnswers: vi.fn(),
  listUserLessonQuizAttempts: vi.fn(),
  lockEnrollment: vi.fn(),
  touchEnrollment: vi.fn(),
  getVideoQuestionById: vi.fn(),
  upsertVideoQuestionAnswer: vi.fn(),
  getLessonById: vi.fn(),
  createLessonQuizAttempt: vi.fn(),
  createLessonQuizAnswers: vi.fn(),
  markLessonCompleted: vi.fn(),
  updateEnrollmentProgress: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({
  db: {
    transaction: dbMocks.transaction,
  },
}));

vi.mock('./courses.repository.js', () => ({
  coursesRepository: repositoryMocks,
}));

vi.mock('../audit-logs/audit-logs.service.js', () => ({
  auditLogsService: {
    recordAction: vi.fn(),
  },
}));

vi.mock('../../services/vimeo.service.js', () => ({
  vimeoService: {
    initiateTusUpload: vi.fn(),
    waitForVideoMetadata: vi.fn(),
    ensureEmbedDomains: vi.fn(),
    deleteVideo: vi.fn(),
    resolveVideo: vi.fn(),
    getVideoMetadata: vi.fn(),
    parseVimeoUrl: vi.fn(),
  },
}));

import { coursesService } from './courses.service.js';

function createPublishedCourseFixture() {
  return {
    id: 12,
    title: 'คอร์สตัวอย่าง',
    audience: 'all',
    description: 'คำอธิบายคอร์ส',
    authorName: 'อาจารย์ตัวอย่าง',
    thumbnail: null,
    hasCertificate: false,
    cpeCredits: 0,
    previewVideo: null,
    relatedCourses: [],
    lessons: [
      {
        id: 1,
        title: 'บทเรียนตัวอย่าง',
        sequenceOrder: 1,
        video: {
          id: 5,
          provider: 'VIMEO',
          resourceId: '1175386748',
          duration: 600,
          name: 'ProjectPepsi',
          status: 'READY',
          playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
        },
        videoQuestions: [],
        documents: [],
        lessonQuizzes: [],
      },
    ],
  };
}

describe('coursesService learning side effects', () => {
  beforeEach(() => {
    dbMocks.transaction.mockClear();
    repositoryMocks.getCourseForLearner.mockReset();
    repositoryMocks.findEnrollment.mockReset();
    repositoryMocks.listUserLessonProgress.mockReset();
    repositoryMocks.listUserVideoAnswers.mockReset();
    repositoryMocks.listUserLessonQuizAttempts.mockReset();
    repositoryMocks.lockEnrollment.mockReset();
    repositoryMocks.touchEnrollment.mockReset();
    repositoryMocks.getVideoQuestionById.mockReset();
    repositoryMocks.upsertVideoQuestionAnswer.mockReset();
    repositoryMocks.getLessonById.mockReset();
    repositoryMocks.createLessonQuizAttempt.mockReset();
    repositoryMocks.createLessonQuizAnswers.mockReset();
    repositoryMocks.markLessonCompleted.mockReset();
    repositoryMocks.updateEnrollmentProgress.mockReset();

    repositoryMocks.getCourseForLearner.mockResolvedValue(createPublishedCourseFixture());
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 1,
      userId: 99,
      courseId: 12,
      lastAccessedLessonId: null,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: null,
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([]);
    repositoryMocks.listUserVideoAnswers.mockResolvedValue([]);
    repositoryMocks.listUserLessonQuizAttempts.mockResolvedValue([]);
    repositoryMocks.lockEnrollment.mockResolvedValue(undefined);
    repositoryMocks.touchEnrollment.mockResolvedValue(undefined);
    repositoryMocks.getLessonById.mockResolvedValue({
      id: 1,
      courseId: 12,
    });
    repositoryMocks.createLessonQuizAttempt.mockResolvedValue({
      id: 1,
      finishedAt: '2026-03-24T00:00:00.000Z',
    });
    repositoryMocks.createLessonQuizAnswers.mockResolvedValue([]);
    repositoryMocks.markLessonCompleted.mockResolvedValue({
      updatedAt: '2026-03-24T00:00:00.000Z',
    });
    repositoryMocks.updateEnrollmentProgress.mockResolvedValue({});
  });

  it('does not touch enrollment when only reading the learning snapshot', async () => {
    await coursesService.getCourseLearning(12, 99);

    expect(repositoryMocks.touchEnrollment).not.toHaveBeenCalled();
  });

  it('touches enrollment after a learner submits an interactive answer', async () => {
    repositoryMocks.getVideoQuestionById.mockResolvedValue({
      id: 77,
      questionType: 'MULTIPLE_CHOICE',
      options: [
        { id: 'option-a', text: 'คำตอบ A' },
        { id: 'option-b', text: 'คำตอบ B' },
      ],
      lesson: {
        id: 1,
        course: {
          id: 12,
          status: 'PUBLISHED',
        },
        video: {
          duration: 600,
        },
      },
    });
    repositoryMocks.upsertVideoQuestionAnswer.mockResolvedValue({
      id: 1,
      videoQuestionId: 77,
      answerGiven: 'option-a',
      createdAt: '2026-03-21T00:00:00.000Z',
      updatedAt: '2026-03-21T00:00:00.000Z',
    });

    const answer = await coursesService.answerVideoQuestion(77, 99, {
      answerGiven: 'option-a',
    });

    expect(answer).toMatchObject({
      videoQuestionId: 77,
      answerGiven: 'option-a',
      answered: true,
    });
    expect(repositoryMocks.touchEnrollment).toHaveBeenCalledWith(99, 12, 1, { kind: 'tx' });
  });

  it('blocks general learners from pharmacist-only courses in learning flow', async () => {
    repositoryMocks.getCourseForLearner.mockResolvedValue({
      ...createPublishedCourseFixture(),
      audience: 'pharmacist',
    });

    await expect(
      coursesService.getCourseLearning(12, 99, { role: 'member' }),
    ).rejects.toMatchObject({
      message: 'คุณไม่มีสิทธิ์เข้าถึงคอร์สนี้',
      statusCode: 403,
      code: 'COURSE_ROLE_FORBIDDEN',
    });
  });

  it('submits lesson quiz attempts and touches enrollment', async () => {
    repositoryMocks.getCourseForLearner.mockResolvedValue({
      ...createPublishedCourseFixture(),
      lessons: [
        {
          id: 1,
          title: 'บทเรียนตัวอย่าง',
          sequenceOrder: 1,
          video: {
            id: 5,
            provider: 'VIMEO',
            resourceId: '1175386748',
            duration: 600,
            name: 'ProjectPepsi',
            status: 'READY',
            playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
          },
          videoQuestions: [],
          documents: [],
          lessonQuizzes: [
            {
              id: 44,
              lessonId: 1,
              passingScorePercent: 70,
              maxAttempts: 3,
              questions: [
                {
                  id: 401,
                  lessonQuizId: 44,
                  questionText: 'คำถามท้ายบท',
                  questionType: 'MULTIPLE_CHOICE',
                  options: [
                    { id: 'option-a', text: 'คำตอบ A' },
                    { id: 'option-b', text: 'คำตอบ B' },
                  ],
                  correctAnswer: 'คำตอบ A',
                  scoreWeight: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([
      {
        id: 1,
        userId: 99,
        lessonId: 1,
        lastWatchedSeconds: 600,
        isCompleted: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const attempt = await coursesService.submitLessonQuizAttempt(1, 99, {
      answers: [
        { questionId: 401, answerGiven: 'option-a' },
      ],
    });

    expect(attempt).toMatchObject({
      lessonId: 1,
      quizId: 44,
      isPassed: true,
      scorePercent: 100,
      attemptsUsed: 1,
    });
    expect(repositoryMocks.createLessonQuizAttempt).toHaveBeenCalled();
    expect(repositoryMocks.createLessonQuizAnswers).toHaveBeenCalled();
    expect(repositoryMocks.touchEnrollment).toHaveBeenCalledWith(99, 12, 1, { kind: 'tx' });
  });

  it('blocks lesson quiz attempts until the learner finishes the lesson video first', async () => {
    repositoryMocks.getCourseForLearner.mockResolvedValue({
      ...createPublishedCourseFixture(),
      lessons: [
        {
          id: 1,
          title: 'บทเรียนตัวอย่าง',
          sequenceOrder: 1,
          video: {
            id: 5,
            provider: 'VIMEO',
            resourceId: '1175386748',
            duration: 600,
            name: 'ProjectPepsi',
            status: 'READY',
            playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
          },
          videoQuestions: [],
          documents: [],
          lessonQuizzes: [
            {
              id: 44,
              lessonId: 1,
              passingScorePercent: 70,
              maxAttempts: 3,
              questions: [
                {
                  id: 401,
                  lessonQuizId: 44,
                  questionText: 'คำถามท้ายบท',
                  questionType: 'MULTIPLE_CHOICE',
                  options: [
                    { id: 'option-a', text: 'คำตอบ A' },
                    { id: 'option-b', text: 'คำตอบ B' },
                  ],
                  correctAnswer: 'คำตอบ A',
                  scoreWeight: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([
      {
        id: 1,
        userId: 99,
        lessonId: 1,
        lastWatchedSeconds: 120,
        isCompleted: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    await expect(
      coursesService.submitLessonQuizAttempt(1, 99, {
        answers: [
          { questionId: 401, answerGiven: 'option-a' },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'LESSON_VIDEO_INCOMPLETE',
      message: 'ต้องดูวิดีโอให้จบก่อนทำ Quiz ท้ายบท',
    });
  });

  it('blocks lesson completion until the lesson quiz is passed', async () => {
    repositoryMocks.getCourseForLearner.mockResolvedValue({
      ...createPublishedCourseFixture(),
      lessons: [
        {
          id: 1,
          title: 'บทเรียนตัวอย่าง',
          sequenceOrder: 1,
          video: {
            id: 5,
            provider: 'VIMEO',
            resourceId: '1175386748',
            duration: 600,
            name: 'ProjectPepsi',
            status: 'READY',
            playbackUrl: 'https://player.vimeo.com/video/1175386748?h=testhash',
          },
          videoQuestions: [],
          documents: [{ id: 1, fileName: 'handout.pdf' }],
          lessonQuizzes: [
            {
              id: 44,
              lessonId: 1,
              passingScorePercent: 70,
              maxAttempts: 3,
              questions: [
                {
                  id: 401,
                  lessonQuizId: 44,
                  questionText: 'คำถามท้ายบท',
                  questionType: 'MULTIPLE_CHOICE',
                  options: [
                    { id: 'option-a', text: 'คำตอบ A' },
                    { id: 'option-b', text: 'คำตอบ B' },
                  ],
                  correctAnswer: 'คำตอบ A',
                  scoreWeight: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([
      {
        id: 1,
        userId: 99,
        lessonId: 1,
        lastWatchedSeconds: 600,
        isCompleted: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    await expect(
      coursesService.completeLesson(12, 1, 99),
    ).rejects.toMatchObject({
      code: 'LESSON_QUIZ_INCOMPLETE',
      message: 'กรุณาทำแบบทดสอบท้ายบทให้ผ่านก่อนจบบทเรียน',
    });
  });
});
