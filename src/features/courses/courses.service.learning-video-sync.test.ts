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
  getVideoById: vi.fn(),
  getVideoWithUsage: vi.fn(),
  updateVideoStatus: vi.fn(),
}));

const vimeoMocks = vi.hoisted(() => ({
  getVideoMetadata: vi.fn(),
  ensureEmbedDomains: vi.fn(),
  initiateTusUpload: vi.fn(),
  waitForVideoMetadata: vi.fn(),
  deleteVideo: vi.fn(),
  resolveVideo: vi.fn(),
  parseVimeoUrl: vi.fn(),
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
  vimeoService: vimeoMocks,
}));

import { coursesService } from './courses.service.js';

function createLearnerCourseFixture() {
  return {
    id: 12,
    title: 'คอร์สตัวอย่าง',
    audience: 'all',
    description: 'คำอธิบายคอร์ส',
    authorName: 'ผู้สอนตัวอย่าง',
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
          resourceId: '1176422000',
          duration: 600,
          name: 'Broken Vimeo asset',
          status: 'READY',
          playbackUrl: 'https://player.vimeo.com/video/1176422000?h=testhash',
        },
        videoQuestions: [],
        documents: [],
        lessonQuizzes: [],
      },
    ],
  };
}

describe('coursesService.syncLearningLessonVideo', () => {
  beforeEach(() => {
    dbMocks.transaction.mockClear();
    repositoryMocks.getCourseForLearner.mockReset();
    repositoryMocks.findEnrollment.mockReset();
    repositoryMocks.listUserLessonProgress.mockReset();
    repositoryMocks.listUserVideoAnswers.mockReset();
    repositoryMocks.listUserLessonQuizAttempts.mockReset();
    repositoryMocks.getVideoById.mockReset();
    repositoryMocks.getVideoWithUsage.mockReset();
    repositoryMocks.updateVideoStatus.mockReset();
    vimeoMocks.getVideoMetadata.mockReset();
    vimeoMocks.ensureEmbedDomains.mockReset();

    repositoryMocks.getCourseForLearner.mockResolvedValue(createLearnerCourseFixture());
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 1,
      userId: 99,
      courseId: 12,
      lastAccessedLessonId: null,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: null,
      status: 'ACTIVE',
    });
    repositoryMocks.listUserLessonProgress.mockResolvedValue([]);
    repositoryMocks.listUserVideoAnswers.mockResolvedValue([]);
    repositoryMocks.listUserLessonQuizAttempts.mockResolvedValue([]);
    repositoryMocks.getVideoById.mockResolvedValue({
      id: 5,
      provider: 'VIMEO',
      resourceId: '1176422000',
      duration: 600,
      name: 'Broken Vimeo asset',
      status: 'READY',
      playbackUrl: 'https://player.vimeo.com/video/1176422000?h=testhash',
    });
    repositoryMocks.getVideoWithUsage.mockResolvedValue({
      id: 5,
      provider: 'VIMEO',
      resourceId: '1176422000',
      duration: 600,
      name: 'Broken Vimeo asset',
      status: 'FAILED',
      playbackUrl: 'https://player.vimeo.com/video/1176422000?h=testhash',
      usage: {
        previewCourseCount: 0,
        lessonUsageCount: 1,
        totalUsageCount: 1,
      },
    });
    repositoryMocks.updateVideoStatus.mockResolvedValue({
      id: 5,
      status: 'FAILED',
    });
  });

  it('marks the lesson video as failed when Vimeo no longer has the asset', async () => {
    vimeoMocks.getVideoMetadata.mockRejectedValue(Object.assign(
      new Error('The requested video could not be found.'),
      { statusCode: 404, code: 'VIMEO_METADATA_FAILED' },
    ));

    const result = await coursesService.syncLearningLessonVideo(12, 1, 99);

    expect(vimeoMocks.getVideoMetadata).toHaveBeenCalledWith('1176422000');
    expect(repositoryMocks.updateVideoStatus).toHaveBeenCalledWith(5, 'FAILED');
    expect(result).toEqual({
      lessonId: 1,
      video: {
        id: 5,
        provider: 'VIMEO',
        resourceId: '1176422000',
        duration: 600,
        name: 'Broken Vimeo asset',
        status: 'FAILED',
        playbackUrl: 'https://player.vimeo.com/video/1176422000?h=testhash',
      },
    });
  });
});
