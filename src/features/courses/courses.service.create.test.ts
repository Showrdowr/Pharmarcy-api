import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  getCourseById: vi.fn(),
  getCategoryById: vi.fn(),
  getSubcategoryById: vi.fn(),
  getVideoById: vi.fn(),
  replaceRelatedCourses: vi.fn(),
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

describe('coursesService.createCourse', () => {
  beforeEach(() => {
    repositoryMocks.createCourse.mockReset();
    repositoryMocks.updateCourse.mockReset();
    repositoryMocks.getCourseById.mockReset();
    repositoryMocks.getCategoryById.mockReset();
    repositoryMocks.getSubcategoryById.mockReset();
    repositoryMocks.getVideoById.mockReset();
    repositoryMocks.replaceRelatedCourses.mockReset();

    repositoryMocks.getCategoryById.mockResolvedValue({
      id: 13,
      name: 'อื่นๆ',
      subcategories: [],
    });
    repositoryMocks.getSubcategoryById.mockResolvedValue(null);
    repositoryMocks.getVideoById.mockResolvedValue(null);
    repositoryMocks.createCourse.mockResolvedValue({
      id: 501,
      title: 'คอร์สทดสอบ',
      audience: 'all',
      status: 'DRAFT',
      previewVideoId: null,
    });
    repositoryMocks.updateCourse.mockResolvedValue({
      id: 501,
      title: 'คอร์สทดสอบ',
      audience: 'all',
      status: 'PUBLISHED',
      previewVideoId: null,
    });
    repositoryMocks.getCourseById.mockResolvedValue(null);
  });

  it('clears a stale preview video id before inserting the course', async () => {
    await coursesService.createCourse({
      categoryId: 13,
      title: 'คอร์สทดสอบ',
      audience: 'all',
      skillLevel: 'ALL',
      hasCertificate: false,
      previewVideoId: 999999,
      status: 'DRAFT',
    });

    expect(repositoryMocks.getVideoById).toHaveBeenCalledWith(999999);
    expect(repositoryMocks.createCourse).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 13,
      title: 'คอร์สทดสอบ',
      previewVideoId: null,
      status: 'DRAFT',
    }));
  });

  it('returns a friendly validation error when the category no longer exists', async () => {
    repositoryMocks.getCategoryById.mockResolvedValue(null);

    await expect(coursesService.createCourse({
      categoryId: 999999,
      title: 'คอร์สทดสอบ',
      audience: 'all',
      skillLevel: 'ALL',
      hasCertificate: false,
      status: 'DRAFT',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'COURSE_CATEGORY_NOT_FOUND',
    });

    expect(repositoryMocks.createCourse).not.toHaveBeenCalled();
  });

  it('allows publishing with unlimited seats when maxStudents is 0', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingCourse = {
      id: 501,
      title: 'คอร์สทดสอบ',
      description: 'คำอธิบายคอร์ส',
      details: 'รายละเอียดคอร์ส',
      authorName: 'ภญ.สมใจ',
      categoryId: 13,
      thumbnail: 'base64-thumbnail',
      maxStudents: 0,
      courseEndAt: futureDate,
      publishedAt: null,
      previewVideoId: null,
      lessons: [
        {
          id: 9001,
          title: 'บทที่ 1',
          videoId: 77,
          documents: [{ id: 1, fileName: 'lesson.pdf' }],
          lessonQuiz: { id: 44 },
        },
      ],
    };

    repositoryMocks.getCourseById
      .mockResolvedValueOnce(existingCourse)
      .mockResolvedValueOnce({
        ...existingCourse,
        status: 'PUBLISHED',
      });

    await expect(coursesService.updateCourse(501, {
      status: 'PUBLISHED',
      maxStudents: 0,
    })).resolves.toBeTruthy();

    expect(repositoryMocks.updateCourse).toHaveBeenCalledWith(
      501,
      expect.objectContaining({
        status: 'PUBLISHED',
        maxStudents: 0,
      }),
    );
  });
});
