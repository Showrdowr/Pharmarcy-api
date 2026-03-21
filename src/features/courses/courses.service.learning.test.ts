import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  getPublishedCourseById: vi.fn(),
  findEnrollment: vi.fn(),
  listUserLessonProgress: vi.fn(),
  listUserVideoAnswers: vi.fn(),
  touchEnrollment: vi.fn(),
  getVideoQuestionById: vi.fn(),
  upsertVideoQuestionAnswer: vi.fn(),
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
    repositoryMocks.getPublishedCourseById.mockReset();
    repositoryMocks.findEnrollment.mockReset();
    repositoryMocks.listUserLessonProgress.mockReset();
    repositoryMocks.listUserVideoAnswers.mockReset();
    repositoryMocks.touchEnrollment.mockReset();
    repositoryMocks.getVideoQuestionById.mockReset();
    repositoryMocks.upsertVideoQuestionAnswer.mockReset();

    repositoryMocks.getPublishedCourseById.mockResolvedValue(createPublishedCourseFixture());
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 1,
      userId: 99,
      courseId: 12,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: null,
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([]);
    repositoryMocks.listUserVideoAnswers.mockResolvedValue([]);
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
    expect(repositoryMocks.touchEnrollment).toHaveBeenCalledWith(99, 12);
  });
});
