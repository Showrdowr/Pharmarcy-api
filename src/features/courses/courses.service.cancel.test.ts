import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  transaction: vi.fn(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => callback({ kind: 'tx' })),
}));

const repositoryMocks = vi.hoisted(() => ({
  getCourseForLearner: vi.fn(),
  getPublishedCourseById: vi.fn(),
  findEnrollment: vi.fn(),
  findEnrollmentByStatus: vi.fn(),
  findCertificate: vi.fn(),
  getRefundRequestByEnrollmentId: vi.fn(),
  lockEnrollment: vi.fn(),
  attachEnrollmentSourceOrderItem: vi.fn(),
  findLatestPaidOrderItemForUserCourse: vi.fn(),
  updateEnrollmentStatus: vi.fn(),
  upsertCourseRefundRequest: vi.fn(),
  reactivateEnrollment: vi.fn(),
  countEnrollments: vi.fn(),
  createEnrollment: vi.fn(),
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

describe('coursesService cancellation flow', () => {
  beforeEach(() => {
    dbMocks.transaction.mockClear();
    for (const mockFn of Object.values(repositoryMocks)) {
      mockFn.mockReset();
    }

    repositoryMocks.getCourseForLearner.mockResolvedValue({
      id: 12,
      title: 'Sample Course',
      audience: 'all',
      status: 'PUBLISHED',
      price: '0',
      lessons: [],
      relatedCourses: [],
    });
    repositoryMocks.getPublishedCourseById.mockResolvedValue({
      id: 12,
      title: 'Sample Course',
      audience: 'all',
      status: 'PUBLISHED',
      price: '0',
      maxStudents: null,
    });
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 91,
      userId: 44,
      courseId: 12,
      status: 'ACTIVE',
      isCompleted: false,
      sourceOrderItemId: null,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });
    repositoryMocks.findEnrollmentByStatus.mockResolvedValue({
      id: 91,
      userId: 44,
      courseId: 12,
      status: 'ACTIVE',
      isCompleted: false,
      sourceOrderItemId: null,
      enrolledAt: '2026-03-01T00:00:00.000Z',
      lastAccessedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });
    repositoryMocks.findCertificate.mockResolvedValue(null);
    repositoryMocks.lockEnrollment.mockResolvedValue(undefined);
    repositoryMocks.attachEnrollmentSourceOrderItem.mockResolvedValue(undefined);
    repositoryMocks.findLatestPaidOrderItemForUserCourse.mockResolvedValue(null);
    repositoryMocks.updateEnrollmentStatus.mockResolvedValue({
      id: 91,
      cancelledAt: '2026-03-24T00:00:00.000Z',
    });
    repositoryMocks.upsertCourseRefundRequest.mockResolvedValue({
      id: 501,
      status: 'PENDING',
      reason: 'Need refund',
      requestedAt: '2026-03-24T00:00:00.000Z',
    });
    repositoryMocks.reactivateEnrollment.mockResolvedValue({
      id: 91,
      courseId: 12,
      status: 'ACTIVE',
    });
    repositoryMocks.countEnrollments.mockResolvedValue(0);
    repositoryMocks.createEnrollment.mockResolvedValue({
      id: 91,
      courseId: 12,
      status: 'ACTIVE',
    });
  });

  it('soft-cancels free courses immediately', async () => {
    const result = await coursesService.cancelCourse(12, 44, { reason: 'Not interested' });

    expect(result).toMatchObject({
      courseId: 12,
      enrollmentStatus: 'CANCELLED',
      cancelReason: 'Not interested',
      refundRequest: null,
    });
    expect(repositoryMocks.updateEnrollmentStatus).toHaveBeenCalledWith(
      44,
      12,
      'CANCELLED',
      expect.objectContaining({
        cancelReason: 'Not interested',
      }),
      { kind: 'tx' },
    );
    expect(repositoryMocks.upsertCourseRefundRequest).not.toHaveBeenCalled();
  });

  it('creates a refund request for paid course cancellations', async () => {
    repositoryMocks.getCourseForLearner.mockResolvedValue({
      id: 12,
      title: 'Paid Course',
      audience: 'all',
      status: 'PUBLISHED',
      price: '1500',
      lessons: [],
      relatedCourses: [],
    });
    repositoryMocks.findLatestPaidOrderItemForUserCourse.mockResolvedValue({
      orderItemId: 333,
      orderId: 200,
    });

    const result = await coursesService.cancelCourse(12, 44, { reason: 'Need refund' });

    expect(result).toMatchObject({
      enrollmentStatus: 'REFUND_PENDING',
      refundRequest: {
        id: 501,
        status: 'PENDING',
      },
    });
    expect(repositoryMocks.updateEnrollmentStatus).toHaveBeenCalledWith(
      44,
      12,
      'REFUND_PENDING',
      expect.objectContaining({
        sourceOrderItemId: 333,
      }),
      { kind: 'tx' },
    );
    expect(repositoryMocks.upsertCourseRefundRequest).toHaveBeenCalled();
  });

  it('blocks cancellation after completion or certificate issuance', async () => {
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 91,
      userId: 44,
      courseId: 12,
      status: 'ACTIVE',
      isCompleted: true,
    });

    await expect(
      coursesService.cancelCourse(12, 44, {}),
    ).rejects.toMatchObject({
      code: 'COURSE_CANCEL_NOT_ALLOWED',
    });
  });

  it('reactivates cancelled free-course enrollments on re-enroll', async () => {
    repositoryMocks.getPublishedCourseById.mockResolvedValue({
      id: 12,
      title: 'Sample Course',
      audience: 'all',
      status: 'PUBLISHED',
      price: '0',
      maxStudents: null,
    });
    repositoryMocks.findEnrollment.mockResolvedValue({
      id: 91,
      userId: 44,
      courseId: 12,
      status: 'CANCELLED',
      isCompleted: false,
    });

    const enrollment = await coursesService.enrollCourse(12, 44);

    expect(enrollment).toMatchObject({
      id: 91,
      status: 'ACTIVE',
    });
    expect(repositoryMocks.reactivateEnrollment).toHaveBeenCalledWith(44, 12);
    expect(repositoryMocks.createEnrollment).not.toHaveBeenCalled();
  });
});
