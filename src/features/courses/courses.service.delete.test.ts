import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  getCourseById: vi.fn(),
  getCourseDeletionBlockers: vi.fn(),
  deleteCourse: vi.fn(),
  countVideoUsage: vi.fn(),
  getVideoById: vi.fn(),
  deleteVideo: vi.fn(),
  getLessonById: vi.fn(),
  deleteLesson: vi.fn(),
  updateLesson: vi.fn(),
  updateCourse: vi.fn(),
}));

const vimeoMocks = vi.hoisted(() => ({
  deleteVideo: vi.fn(),
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
    deleteVideo: vimeoMocks.deleteVideo,
    resolveVideo: vi.fn(),
    getVideoMetadata: vi.fn(),
    parseVimeoUrl: vi.fn(),
  },
}));

import { coursesService } from './courses.service.js';

describe('coursesService.deleteCourse', () => {
  beforeEach(() => {
    repositoryMocks.getCourseById.mockReset();
    repositoryMocks.getCourseDeletionBlockers.mockReset();
    repositoryMocks.deleteCourse.mockReset();
    repositoryMocks.countVideoUsage.mockReset();
    repositoryMocks.getVideoById.mockReset();
    repositoryMocks.deleteVideo.mockReset();
    repositoryMocks.getLessonById.mockReset();
    repositoryMocks.deleteLesson.mockReset();
    repositoryMocks.updateLesson.mockReset();
    repositoryMocks.updateCourse.mockReset();

    repositoryMocks.getCourseById.mockResolvedValue({
      id: 46,
      title: 'คอร์สที่ต้องการลบ',
      lessons: [],
    });
    repositoryMocks.getCourseDeletionBlockers.mockResolvedValue({
      enrollmentsCount: 0,
      certificatesCount: 0,
      orderItemsCount: 0,
    });
    repositoryMocks.deleteCourse.mockResolvedValue({
      course: {
        id: 46,
        title: 'คอร์สที่ต้องการลบ',
      },
      deletedVideos: [],
    });
    repositoryMocks.countVideoUsage.mockResolvedValue(0);
    repositoryMocks.getVideoById.mockResolvedValue({
      id: 113,
      provider: 'VIMEO',
      resourceId: '117579661',
    });
    repositoryMocks.deleteVideo.mockResolvedValue({
      id: 113,
      provider: 'VIMEO',
      resourceId: '117579661',
    });
    vimeoMocks.deleteVideo.mockReset();
    vimeoMocks.deleteVideo.mockResolvedValue(undefined);
  });

  it('blocks hard delete when the course has learner or order history', async () => {
    repositoryMocks.getCourseDeletionBlockers.mockResolvedValue({
      enrollmentsCount: 1,
      certificatesCount: 0,
      orderItemsCount: 2,
    });

    await expect(coursesService.deleteCourse(46)).rejects.toMatchObject({
      statusCode: 409,
      code: 'COURSE_DELETE_CONFLICT',
    });
    expect(repositoryMocks.deleteCourse).not.toHaveBeenCalled();
  });

  it('deletes the course when there is no learner or order history left', async () => {
    const result = await coursesService.deleteCourse(46);

    expect(repositoryMocks.getCourseDeletionBlockers).toHaveBeenCalledWith(46);
    expect(repositoryMocks.deleteCourse).toHaveBeenCalledWith(46);
    expect(result).toMatchObject({
      id: 46,
      title: 'คอร์สที่ต้องการลบ',
    });
  });

  it('cleans up orphaned Vimeo videos after deleting a course', async () => {
    repositoryMocks.deleteCourse.mockResolvedValue({
      course: {
        id: 46,
        title: 'คอร์สที่ต้องการลบ',
      },
      deletedVideos: [
        {
          id: 113,
          provider: 'VIMEO',
          resourceId: '117579661',
        },
        {
          id: 114,
          provider: 'S3',
          resourceId: 'local-file',
        },
      ],
    });

    const result = await coursesService.deleteCourse(46);
    await Promise.resolve();

    expect(result).toMatchObject({
      id: 46,
      title: 'คอร์สที่ต้องการลบ',
    });
    expect(vimeoMocks.deleteVideo).toHaveBeenCalledTimes(1);
    expect(vimeoMocks.deleteVideo).toHaveBeenCalledWith('117579661');
  });

  it('deletes the DB row for a direct video deletion even if Vimeo cleanup fails', async () => {
    vimeoMocks.deleteVideo.mockRejectedValueOnce(new Error('vimeo delete failed'));

    const result = await coursesService.deleteVideo(113);

    expect(repositoryMocks.countVideoUsage).toHaveBeenCalledWith(113);
    expect(repositoryMocks.getVideoById).toHaveBeenCalledWith(113);
    expect(repositoryMocks.deleteVideo).toHaveBeenCalledWith(113);
    expect(result).toMatchObject({ id: 113 });
  });

  it('cleans up an orphaned lesson video after deleting a lesson', async () => {
    repositoryMocks.getLessonById.mockResolvedValue({
      id: 77,
      videoId: 113,
    });
    repositoryMocks.deleteLesson.mockResolvedValue({
      id: 77,
      videoId: 113,
    });

    const result = await coursesService.deleteLesson(77);

    expect(repositoryMocks.deleteLesson).toHaveBeenCalledWith(77);
    expect(repositoryMocks.countVideoUsage).toHaveBeenCalledWith(113);
    expect(repositoryMocks.deleteVideo).toHaveBeenCalledWith(113);
    expect(result).toMatchObject({ id: 77 });
  });
});
