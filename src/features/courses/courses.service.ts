import { coursesRepository } from './courses.repository.js';
import { auditLogsService } from '../audit-logs/audit-logs.service.js';
import { db } from '../../db/index.js';
import { env } from '../../config/env.js';
import {
  normalizeCourseThumbnail,
  normalizeThumbnailForStorage,
  validateThumbnailSizeLimit,
} from './courses.utils.js';
import {
  isInteractiveQuestionAnswered,
  sortInteractiveQuestions,
} from './interactive-runtime.js';
import { resolveInteractiveChoiceAnswer } from './interactive-answer.js';
import {
  assertTypedLessonAccessibleForLearner,
  assertAllowedWatchedProgressAdvance,
  buildLockedLessonLearningPayload,
  calculateMonotonicWatchedSeconds,
  getCompletedLessonSet as buildCompletedLessonSet,
  isLessonUnlocked as isLessonUnlockedByIndex,
} from './learning-access.js';
import { deriveVideoStatus, type VideoStatus } from './video-status.js';
import {
  canViewerAccessCourse,
  canViewerSeeCourse,
  normalizeCourseAudience,
  resolveCourseViewerRole,
  type CourseAccessUser,
} from './course-audience.js';
import { vimeoService } from '../../services/vimeo.service.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  CreateCourseInput,
  UpdateCourseInput,
  CreateLessonInput,
  UpdateLessonInput,
  CreateLessonDocumentInput,
  CreateVideoQuestionInput,
  CreateVideoQuestionBulkInput,
  UpdateVideoQuestionInput,
  CreateVideoQuestionAnswerInput,
  UpdateLessonProgressInput,
  UpdateCourseRelatedInput,
  CreateLessonQuizInput,
  UpdateLessonQuizInput,
  CreateLessonQuizQuestionInput,
  UpdateLessonQuizQuestionInput,
  CreateLessonQuizAttemptInput,
  CancelCourseInput,
  CreateExamInput,
  UpdateExamInput,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
  CreateVideoUploadInitiateInput,
  CompleteVideoUploadInput,
  CreateCourseReviewInput,
  ResolveVimeoVideoInput,
  ImportVimeoVideoInput,
  ResolveRefundRequestInput,
} from './courses.schema.js';

type LearningSnapshot = Awaited<ReturnType<typeof buildLearningSnapshot>>;

type ProgressRow = {
  id: number;
  userId: number;
  lessonId: number;
  lastWatchedSeconds: number | null;
  isCompleted: boolean | null;
  updatedAt: Date | string | null;
};

type AnswerRow = {
  id: number;
  userId: number;
  videoQuestionId: number;
  answerGiven: string | null;
  isCorrect: boolean | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

type LessonQuizAttemptRow = {
  id: number;
  userId: number;
  lessonQuizId: number;
  scoreObtained: string | number | null;
  totalScore: string | number | null;
  scorePercent: string | number | null;
  isPassed: boolean | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
};

type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type EnrollmentStatus = 'ACTIVE' | 'CANCELLED' | 'REFUND_PENDING';
type EnrolledCourseStatusFilter = 'active' | 'cancelled' | 'all';
type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type VideoListFilters = {
  search?: string;
  provider?: 'YOUTUBE' | 'VIMEO' | 'CLOUDFLARE' | 'S3';
  status?: VideoStatus;
  used?: boolean;
  page?: number;
  limit?: number;
};

const DEFAULT_CATEGORY_SEED: CreateCategoryInput[] = [
  { name: 'วิทยาลัยเภสัชบำบัด', description: 'คอร์สด้านการดูแลผู้ป่วยและการใช้ยาอย่างเหมาะสม', color: 'blue' },
  { name: 'วิทยาลัยเภสัชกรรมชุมชน', description: 'คอร์สด้านงานบริการเภสัชกรรมปฐมภูมิและร้านยา', color: 'rose' },
  { name: 'วิทยาลัยคุ้มครองผู้บริโภคด้านยาฯ', description: 'คอร์สด้านกฎหมายยาและคุ้มครองผู้บริโภค', color: 'emerald' },
  { name: 'วิทยาลัยเภสัชกรรมสมุนไพร', description: 'คอร์สด้านผลิตภัณฑ์สมุนไพรและการใช้ในเวชปฏิบัติ', color: 'violet' },
  { name: 'วิทยาลัยเภสัชกรรมอุตสาหการ', description: 'คอร์สด้านการผลิตและประกันคุณภาพยา', color: 'amber' },
  { name: 'วิทยาลัยการบริหารเภสัชกิจ', description: 'คอร์สด้านบริหารจัดการระบบยาและองค์กร', color: 'cyan' },
  { name: 'วิทยาลัยเภสัชพันธุศาสตร์ฯ', description: 'คอร์สด้านเภสัชพันธุศาสตร์และการแพทย์แม่นยำ', color: 'pink' },
  { name: 'วิทยาลัยเภสัชกรรมโรงพยาบาล', description: 'คอร์สด้านระบบยาในโรงพยาบาลและงานคลังยา', color: 'slate' },
];

function buildAppError(message: string, statusCode = 400, code?: string, details?: unknown) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
    details,
  });
}

function shouldMarkVideoFailed(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; statusCode?: number };
  return candidate.code === 'VIMEO_METADATA_FAILED'
    || candidate.code === 'VIMEO_RESOLVE_FAILED'
    || candidate.code === 'VIMEO_INVALID_URL'
    || candidate.code === 'VIMEO_PRIVACY_UPDATE_FAILED'
    || candidate.code === 'VIMEO_EMBED_DOMAIN_FAILED'
    || candidate.statusCode === 403
    || candidate.statusCode === 404;
}

function parseDateValue(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeFreeTextAnswer(value?: string | null) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function normalizeLessonQuizAttemptSummary(attempt: LessonQuizAttemptRow | null | undefined, attemptNumber: number) {
  if (!attempt) {
    return null;
  }

  return {
    id: Number(attempt.id),
    attemptNumber,
    scoreObtained: Number(attempt.scoreObtained ?? 0),
    totalScore: Number(attempt.totalScore ?? 0),
    scorePercent: Number(attempt.scorePercent ?? 0),
    isPassed: Boolean(attempt.isPassed),
    finishedAt: attempt.finishedAt ?? null,
  };
}

function normalizeEnrollmentStatus(value: unknown): EnrollmentStatus {
  const candidate = String(value ?? 'ACTIVE').toUpperCase();
  if (candidate === 'CANCELLED' || candidate === 'REFUND_PENDING') {
    return candidate;
  }
  return 'ACTIVE';
}

function normalizeRefundRequestStatus(value: unknown): RefundRequestStatus | null {
  const candidate = String(value ?? '').toUpperCase();
  if (candidate === 'PENDING' || candidate === 'APPROVED' || candidate === 'REJECTED') {
    return candidate;
  }
  return null;
}

function buildEnrollmentInactiveError(
  status: EnrollmentStatus,
  refundRequestStatus?: RefundRequestStatus | null,
) {
  if (status === 'CANCELLED') {
    return buildAppError('คุณได้ยกเลิกคอร์สนี้แล้ว กรุณาลงเรียนอีกครั้งหากต้องการเรียนต่อ', 403, 'COURSE_ENROLLMENT_CANCELLED');
  }

  if (refundRequestStatus === 'APPROVED') {
    return buildAppError('คอร์สนี้ถูกยกเลิกและคืนเงินแล้ว หากต้องการเรียนอีกครั้งกรุณาซื้อใหม่', 403, 'COURSE_REFUND_APPROVED');
  }

  if (refundRequestStatus === 'REJECTED') {
    return buildAppError('คำขอคืนเงินของคอร์สนี้ถูกปฏิเสธ กรุณาติดต่อผู้ดูแลหากต้องการกลับเข้าเรียน', 403, 'COURSE_REFUND_REJECTED');
  }

  return buildAppError('คอร์สนี้อยู่ระหว่างดำเนินการคืนเงิน จึงยังไม่สามารถเข้าเรียนต่อได้', 403, 'COURSE_REFUND_PENDING');
}

function normalizeRefundRequestSummary(refundRequest: any) {
  if (!refundRequest) {
    return null;
  }

  return {
    id: Number(refundRequest.id),
    status: normalizeRefundRequestStatus(refundRequest.status) ?? 'PENDING',
    reason: refundRequest.reason ?? null,
    adminNote: refundRequest.adminNote ?? null,
    requestedAt: refundRequest.requestedAt ?? null,
    resolvedAt: refundRequest.resolvedAt ?? null,
    resolvedByAdminId: refundRequest.resolvedByAdminId ?? null,
    orderItemId: refundRequest.orderItemId ?? null,
  };
}

function normalizeLessonQuizQuestionForLearner(question: any) {
  return {
    id: Number(question.id),
    questionText: question.questionText,
    questionType: question.questionType,
    options: Array.isArray(question.options)
      ? question.options.map((option: any, index: number) => ({
          id: typeof option?.id === 'string' && option.id.trim() ? option.id : `option-${index + 1}`,
          text: String(option?.text ?? ''),
        }))
      : [],
    scoreWeight: Number(question.scoreWeight ?? 1),
  };
}

function normalizeInteractiveQuestion(question: any, options?: { includeCorrectAnswer?: boolean }) {
  const includeCorrectAnswer = options?.includeCorrectAnswer ?? true;
  const normalized = {
    ...question,
    displayAtSeconds: Number(question.displayAtSeconds ?? 0),
    sortOrder: Number(question.sortOrder ?? 0),
    options: Array.isArray(question.options) ? question.options : [],
  };

  if (includeCorrectAnswer) {
    return normalized;
  }

  return {
    ...normalized,
    correctAnswer: undefined,
  };
}

function normalizeLessonDocumentForResponse(document: any, options?: { includeFileUrl?: boolean }) {
  const includeFileUrl = options?.includeFileUrl ?? false;
  return {
    id: Number(document.id),
    lessonId: Number(document.lessonId),
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes ?? 0),
    createdAt: document.createdAt ?? null,
    ...(includeFileUrl ? { fileUrl: document.fileUrl } : {}),
  };
}

function normalizeLessonForResponse(lesson: any) {
  const lessonQuiz = lesson.lessonQuiz ?? (Array.isArray(lesson.lessonQuizzes) ? lesson.lessonQuizzes[0] ?? null : null);
  return {
    ...lesson,
    video: lesson.video ? normalizeVideoForResponse(lesson.video) : null,
    videoQuestions: sortInteractiveQuestions(
      Array.isArray(lesson.videoQuestions)
        ? lesson.videoQuestions.map((question: any) => normalizeInteractiveQuestion(question))
        : []
    ),
    documents: Array.isArray(lesson.documents)
      ? lesson.documents.map((document: any) => normalizeLessonDocumentForResponse(document))
      : [],
    documentsCount: Array.isArray(lesson.documents) ? lesson.documents.length : 0,
    lessonQuiz,
    hasQuiz: Boolean(lessonQuiz),
  };
}

function normalizeRelatedCourseForResponse(course: any) {
  return normalizeCourseThumbnail({
    ...course,
    thumbnail: course.thumbnail,
  });
}

function normalizeCourseForAdmin(course: any) {
  return normalizeCourseThumbnail({
    ...course,
    previewVideo: course.previewVideo ? normalizeVideoForResponse(course.previewVideo) : null,
    relatedCourses: Array.isArray(course.relatedCourses)
      ? course.relatedCourses.map((relatedCourse: any) => normalizeRelatedCourseForResponse(relatedCourse))
      : [],
    lessons: Array.isArray(course.lessons)
      ? course.lessons.map((lesson: any) => normalizeLessonForResponse(lesson))
      : [],
  });
}

function normalizeCourseForPublic(course: any) {
  const normalized = normalizeCourseForAdmin(course);
  return {
    ...normalized,
    relatedCourses: Array.isArray(normalized.relatedCourses)
      ? normalized.relatedCourses
          .filter((relatedCourse: any) => relatedCourse.status === 'PUBLISHED')
          .map((relatedCourse: any) => ({
            id: relatedCourse.id,
            title: relatedCourse.title,
            titleEn: relatedCourse.titleEn ?? null,
            description: relatedCourse.description ?? null,
            descriptionEn: relatedCourse.descriptionEn ?? null,
            thumbnail: relatedCourse.thumbnail,
            authorName: relatedCourse.authorName,
            price: Number(relatedCourse.price ?? 0),
            cpeCredits: Number(relatedCourse.cpeCredits ?? 0),
            audience: normalizeCourseAudience(relatedCourse.audience),
            enrolledCount: relatedCourse.enrolledCount ?? relatedCourse.enrollmentsCount ?? 0,
            enrollmentsCount: relatedCourse.enrolledCount ?? relatedCourse.enrollmentsCount ?? 0,
            totalDurationSeconds: Number(relatedCourse.totalDurationSeconds ?? 0),
            durationMinutes: Number(relatedCourse.durationMinutes ?? 0),
            category: relatedCourse.category ?? null,
          }))
      : [],
    lessons: Array.isArray(normalized.lessons)
      ? normalized.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          sequenceOrder: lesson.sequenceOrder,
          documentsCount: lesson.documentsCount ?? 0,
          hasQuiz: Boolean(lesson.hasQuiz),
        }))
      : [],
  };
}

function normalizeVideoForResponse(video: any) {
  if (!video) {
    return video;
  }

  const previewCourseCount = Number(video.usage?.previewCourseCount ?? 0);
  const lessonUsageCount = Number(video.usage?.lessonUsageCount ?? 0);
  const totalUsageCount = Number(video.usage?.totalUsageCount ?? previewCourseCount + lessonUsageCount);

  return {
    ...video,
    duration: Number(video.duration ?? 0),
    playbackUrl: typeof video.playbackUrl === 'string' && video.playbackUrl.trim().length > 0
      ? video.playbackUrl
      : null,
    status: (video.status ?? 'PROCESSING') as VideoStatus,
    usage: {
      previewCourseCount,
      lessonUsageCount,
      totalUsageCount,
    },
  };
}

function normalizeCourseReview(review: any) {
  return {
    id: Number(review.id),
    rating: Number(review.rating ?? 0),
    title: review.title ?? null,
    body: review.body ?? null,
    reviewerName: review.reviewerName ?? 'Anonymous',
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

async function ensureDefaultCategoriesSeeded() {
  const categories = await coursesRepository.listCategories();
  if (categories.length > 0) {
    return categories;
  }

  for (const category of DEFAULT_CATEGORY_SEED) {
    await coursesRepository.createCategory(category);
  }

  return await coursesRepository.listCategories();
}

function ensureDraftRequirements(courseLike: Record<string, any>) {
  if (!String(courseLike.title || '').trim()) {
    throw buildAppError('ฉบับร่างต้องมีชื่อคอร์ส', 400);
  }

  if (!courseLike.categoryId) {
    throw buildAppError('ฉบับร่างต้องมีหมวดหมู่หลัก', 400);
  }
}

function ensurePublishedScalarRequirements(courseLike: Record<string, any>) {
  if (!String(courseLike.title || '').trim()) {
    throw buildAppError('กรุณาระบุชื่อคอร์สก่อนเผยแพร่', 400);
  }

  if (!String(courseLike.description || '').trim()) {
    throw buildAppError('กรุณาระบุคำอธิบายโดยย่อก่อนเผยแพร่', 400);
  }

  if (!String(courseLike.details || '').trim()) {
    throw buildAppError('กรุณาระบุรายละเอียดคอร์สก่อนเผยแพร่', 400);
  }

  if (!String(courseLike.authorName || '').trim()) {
    throw buildAppError('กรุณาระบุชื่อผู้สอนก่อนเผยแพร่', 400);
  }

  if (!courseLike.categoryId) {
    throw buildAppError('กรุณาเลือกหมวดหมู่หลักก่อนเผยแพร่', 400);
  }

  if (!courseLike.thumbnail) {
    throw buildAppError('กรุณาอัปโหลดรูปปกก่อนเผยแพร่', 400);
  }

  if (
    courseLike.maxStudents !== undefined
    && courseLike.maxStudents !== null
    && Number(courseLike.maxStudents) < 0
  ) {
    throw buildAppError('จำนวนรับต้องไม่น้อยกว่า 0', 400);
  }

  const courseEndAt = parseDateValue(courseLike.courseEndAt);
  if (!courseEndAt) {
    throw buildAppError('กรุณาระบุวันสิ้นสุดคอร์สก่อนเผยแพร่', 400);
  }

  if (courseEndAt.getTime() <= Date.now()) {
    throw buildAppError('วันสิ้นสุดคอร์สต้องมากกว่าวันปัจจุบัน', 400);
  }
}

function ensurePublishedLessonRequirements(courseLike: Record<string, any>) {
  const lessonItems = Array.isArray(courseLike.lessons) ? courseLike.lessons : [];
  if (lessonItems.length === 0) {
    throw buildAppError('ต้องมีอย่างน้อย 1 บทเรียนก่อนเผยแพร่', 400);
  }

  for (const lesson of lessonItems) {
    if (!lesson.videoId) {
      throw buildAppError(`บทเรียน "${lesson.title}" ยังไม่มีวิดีโอ`, 400);
    }

    const documents = Array.isArray(lesson.documents) ? lesson.documents : [];
    if (documents.length === 0) {
      throw buildAppError(`บทเรียน "${lesson.title}" ต้องมีเอกสารอย่างน้อย 1 ไฟล์`, 400);
    }

    const lessonQuiz = lesson.lessonQuiz ?? (Array.isArray(lesson.lessonQuizzes) ? lesson.lessonQuizzes[0] ?? null : null);
    if (!lessonQuiz) {
      throw buildAppError(`บทเรียน "${lesson.title}" ต้องมีแบบทดสอบท้ายบท`, 400);
    }
  }
}

function validateCourseForStatus(courseLike: Record<string, any>) {
  const status = String(courseLike.status || 'DRAFT').toUpperCase() as CourseStatus;

  if (status === 'DRAFT') {
    ensureDraftRequirements(courseLike);
    return;
  }

  if (status === 'PUBLISHED') {
    ensurePublishedScalarRequirements(courseLike);
    ensurePublishedLessonRequirements(courseLike);
  }
}

type CourseWriteReferencePayload = {
  categoryId?: number | null;
  subcategoryId?: number | null;
  previewVideoId?: number | null;
};

async function sanitizeCourseWriteReferences<T extends CourseWriteReferencePayload>(
  payload: T,
  options?: { fallbackCategoryId?: number | null },
) {
  const nextPayload = { ...payload };

  if (typeof nextPayload.categoryId === 'number') {
    const category = await coursesRepository.getCategoryById(nextPayload.categoryId);
    if (!category) {
      throw buildAppError('ไม่พบหมวดหมู่หลักที่เลือก กรุณาเลือกใหม่', 400, 'COURSE_CATEGORY_NOT_FOUND');
    }
  }

  const effectiveCategoryId = typeof nextPayload.categoryId === 'number'
    ? nextPayload.categoryId
    : typeof options?.fallbackCategoryId === 'number'
      ? options.fallbackCategoryId
      : null;

  if (typeof nextPayload.subcategoryId === 'number') {
    const subcategory = await coursesRepository.getSubcategoryById(nextPayload.subcategoryId);
    if (!subcategory) {
      throw buildAppError('ไม่พบหมวดหมู่ย่อยที่เลือก กรุณาเลือกใหม่', 400, 'COURSE_SUBCATEGORY_NOT_FOUND');
    }

    if (effectiveCategoryId !== null && Number(subcategory.categoryId) !== effectiveCategoryId) {
      throw buildAppError('หมวดหมู่ย่อยไม่สอดคล้องกับหมวดหมู่หลักที่เลือก', 400, 'COURSE_SUBCATEGORY_MISMATCH');
    }
  }

  if (typeof nextPayload.previewVideoId === 'number') {
    const previewVideo = await coursesRepository.getVideoById(nextPayload.previewVideoId);
    if (!previewVideo) {
      console.warn(`Course write requested missing preview video ${nextPayload.previewVideoId}; clearing stale reference.`);
      nextPayload.previewVideoId = null;
    }
  }

  return nextPayload;
}

function calculateProgressPercent(completedLessons: number, totalLessons: number) {
  if (totalLessons <= 0) {
    return 0;
  }

  return Number(((completedLessons / totalLessons) * 100).toFixed(2));
}

function calculateWatchPercent(watchedSeconds: number, totalDurationSeconds: number) {
  if (totalDurationSeconds <= 0) {
    return 0;
  }

  return Number((((Math.min(Math.max(watchedSeconds, 0), totalDurationSeconds)) / totalDurationSeconds) * 100).toFixed(2));
}

function calculateCourseWatchMetrics(
  lessons: any[],
  progressMap: Map<number, { lastWatchedSeconds?: number | null; isCompleted?: boolean | null }>
) {
  let totalDurationSeconds = 0;
  let watchedSeconds = 0;

  for (const lesson of lessons) {
    const lessonId = Number(lesson.id);
    const duration = Math.max(0, Number(lesson.video?.duration ?? 0));
    if (duration <= 0) {
      continue;
    }

    totalDurationSeconds += duration;
    const progress = progressMap.get(lessonId);
    const effectiveWatchedSeconds = progress?.isCompleted
      ? duration
      : Number(progress?.lastWatchedSeconds ?? 0);

    watchedSeconds += Math.min(duration, Math.max(0, effectiveWatchedSeconds));
  }

  return {
    watchedSeconds,
    totalDurationSeconds,
    watchPercent: calculateWatchPercent(watchedSeconds, totalDurationSeconds),
  };
}

function getLessonWatchThreshold(duration?: number | null) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(duration));
}

function assertLessonQuizReadyForLearner(snapshot: LearningSnapshot, lesson: any) {
  const lessonId = Number(lesson.id);
  const currentProgress = snapshot.progressMap.get(lessonId);
  const watchedSeconds = Number(currentProgress?.lastWatchedSeconds ?? 0);
  const watchThreshold = getLessonWatchThreshold(Number(lesson.video?.duration ?? 0));
  if (watchThreshold > 0 && watchedSeconds < watchThreshold) {
    throw buildAppError('ต้องดูวิดีโอให้จบก่อนทำ Quiz ท้ายบท', 409, 'LESSON_VIDEO_INCOMPLETE');
  }

  const unansweredInteractive = sortInteractiveQuestions(Array.isArray(lesson.videoQuestions) ? lesson.videoQuestions : [])
    .find((question: any) => {
      const answer = snapshot.answerMap.get(Number(question.id));
      return !isInteractiveQuestionAnswered(question, answer);
    });

  if (unansweredInteractive) {
    throw buildAppError('กรุณาตอบคำถาม interactive ให้ครบก่อนทำ Quiz ท้ายบท', 409, 'INTERACTIVE_INCOMPLETE');
  }
}

function buildTrueFalseOptions() {
  return [
    { id: 'true', text: 'จริง' },
    { id: 'false', text: 'เท็จ' },
  ];
}

function normalizeInteractiveQuestionPayload(data: CreateVideoQuestionInput | UpdateVideoQuestionInput) {
  const questionText = typeof data.questionText === 'string' ? data.questionText.trim() : data.questionText;
  const questionType = data.questionType;
  const rawOptions = Array.isArray(data.options)
    ? data.options
        .map((option, index) => ({
          id: option.id || `${index + 1}`,
          text: String(option.text || '').trim(),
        }))
        .filter((option) => option.text.length > 0)
    : undefined;

  if (questionType === 'MULTIPLE_CHOICE' && data.options !== undefined && (rawOptions?.length ?? 0) < 2) {
    throw buildAppError('คำถามแบบตัวเลือกต้องมีอย่างน้อย 2 ตัวเลือก', 400);
  }

  if (questionType === 'TRUE_FALSE') {
    const normalizedCorrectAnswer =
      typeof data.correctAnswer === 'string'
        ? resolveInteractiveChoiceAnswer(buildTrueFalseOptions(), data.correctAnswer)
        : null;

    if (data.correctAnswer !== undefined && data.correctAnswer !== null && !normalizedCorrectAnswer) {
      throw buildAppError('กรุณาระบุคำตอบสำหรับคำถามจริง/เท็จให้ถูกต้อง', 400);
    }

    return {
      ...data,
      questionText,
      options: buildTrueFalseOptions(),
      correctAnswer: normalizedCorrectAnswer,
    };
  }

  if (questionType === 'SHORT_ANSWER') {
    return {
      ...data,
      questionText,
      options: undefined,
      correctAnswer: null,
    };
  }

  return {
    ...data,
    questionText,
    options: rawOptions,
    correctAnswer: null,
  };
}

async function withRelatedCourses(courseId: number, relatedCourseIds?: number[]) {
  if (!Array.isArray(relatedCourseIds)) {
    return;
  }

  await coursesRepository.replaceRelatedCourses(courseId, relatedCourseIds);
}

function filterVisibleCoursesForViewer<T extends { audience?: string | null }>(
  courses: T[],
  viewer?: CourseAccessUser,
) {
  const viewerRole = resolveCourseViewerRole(viewer);
  return courses.filter((course) => canViewerSeeCourse(course.audience, viewerRole));
}

function filterVisibleRelatedCourses<T extends { relatedCourses?: Array<{ audience?: string | null }> }>(
  course: T,
  viewer?: CourseAccessUser,
) {
  if (!Array.isArray(course.relatedCourses)) {
    return course;
  }

  return {
    ...course,
    relatedCourses: filterVisibleCoursesForViewer(course.relatedCourses, viewer),
  };
}

function assertViewerCanAccessCourseOrThrow(course: { audience?: string | null }, viewer?: CourseAccessUser) {
  const viewerRole = viewer ? resolveCourseViewerRole(viewer) : 'general';
  if (!canViewerAccessCourse(course.audience, viewerRole)) {
    throw buildAppError('คุณไม่มีสิทธิ์เข้าถึงคอร์สนี้', 403, 'COURSE_ROLE_FORBIDDEN');
  }
}

async function getLearnerAccessibleCourseOrThrow(courseId: number, userId: number, viewer?: CourseAccessUser, tx?: any) {
  const course = await coursesRepository.getCourseForLearner(courseId, tx);
  if (!course) {
    throw buildAppError('Course not found', 404);
  }

  if (course.status === 'ARCHIVED') {
    const enrollment = await coursesRepository.findEnrollment(userId, courseId, tx);
    if (!enrollment) {
      throw buildAppError('Course not found', 404);
    }
  }

  const normalizedCourse = normalizeCourseForAdmin(course);
  assertViewerCanAccessCourseOrThrow(normalizedCourse, viewer);
  return normalizedCourse;
}

async function getEnrollmentOrThrow(userId: number, courseId: number, tx?: any) {
  const enrollment = await coursesRepository.findEnrollment(userId, courseId, tx);
  if (!enrollment) {
    throw buildAppError('กรุณาสมัครเรียนก่อนเข้าดูเนื้อหา', 403, 'COURSE_NOT_ENROLLED');
  }

  const enrollmentStatus = normalizeEnrollmentStatus(enrollment.status);
  if (enrollmentStatus !== 'ACTIVE') {
    const refundRequest = await coursesRepository.getRefundRequestByEnrollmentId(Number(enrollment.id), tx);
    throw buildEnrollmentInactiveError(enrollmentStatus, normalizeRefundRequestStatus(refundRequest?.status));
  }

  return enrollment;
}

async function buildLearningSnapshot(courseId: number, userId: number, viewer?: CourseAccessUser, tx?: any) {
  const course = await getLearnerAccessibleCourseOrThrow(courseId, userId, viewer, tx);
  const enrollment = await getEnrollmentOrThrow(userId, courseId, tx);

  const lessons = Array.isArray(course.lessons) ? course.lessons.map((lesson: any) => normalizeLessonForResponse(lesson)) : [];
  const lessonIds = lessons.map((lesson: any) => Number(lesson.id));
  const questionIds = lessons.flatMap((lesson: any) =>
    Array.isArray(lesson.videoQuestions) ? lesson.videoQuestions.map((question: any) => Number(question.id)) : []
  );
  const lessonQuizIds = lessons
    .map((lesson: any) => Number(lesson.lessonQuiz?.id ?? 0))
    .filter((quizId: number) => Number.isInteger(quizId) && quizId > 0);

  const [progressRows, answerRows, lessonQuizAttemptRows] = await Promise.all([
    coursesRepository.listUserLessonProgress(userId, lessonIds, tx),
    coursesRepository.listUserVideoAnswers(userId, questionIds, tx),
    coursesRepository.listUserLessonQuizAttempts(userId, lessonQuizIds, tx),
  ]);

  const progressMap = new Map<number, ProgressRow>(
    (progressRows as ProgressRow[]).map((row) => [Number(row.lessonId), row])
  );
  const answerMap = new Map<number, AnswerRow>(
    (answerRows as AnswerRow[])
      .filter((row) => row.videoQuestionId !== null)
      .map((row) => [Number(row.videoQuestionId), row])
  );
  const lessonQuizAttemptMap = new Map<number, LessonQuizAttemptRow>();
  const lessonQuizAttemptCountMap = new Map<number, number>();

  for (const attempt of lessonQuizAttemptRows as LessonQuizAttemptRow[]) {
    const lessonQuizId = Number(attempt.lessonQuizId);
    if (!Number.isInteger(lessonQuizId) || lessonQuizId <= 0) {
      continue;
    }

    lessonQuizAttemptCountMap.set(lessonQuizId, (lessonQuizAttemptCountMap.get(lessonQuizId) ?? 0) + 1);
    if (!lessonQuizAttemptMap.has(lessonQuizId)) {
      lessonQuizAttemptMap.set(lessonQuizId, attempt);
    }
  }

  const completedLessonIds = lessons
    .filter((lesson: any) => Boolean(progressMap.get(Number(lesson.id))?.isCompleted))
    .map((lesson: any) => Number(lesson.id));

  const lastAccessedProgress = ([...progressRows] as ProgressRow[]).sort((left, right) => {
    const leftTime = new Date(left.updatedAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  })[0];

  const explicitLastAccessedLessonId = Number(enrollment.lastAccessedLessonId ?? 0);
  const derivedLastAccessedLessonId = lastAccessedProgress ? Number(lastAccessedProgress.lessonId) : null;
  const resolvedLastAccessedLessonId = Number.isInteger(explicitLastAccessedLessonId) && explicitLastAccessedLessonId > 0
    ? explicitLastAccessedLessonId
    : derivedLastAccessedLessonId;

  const watchMetrics = calculateCourseWatchMetrics(lessons, progressMap);

  return {
    course,
    enrollment,
    lessons,
    progressRows,
    progressMap,
    answerRows,
    answerMap,
    lessonQuizAttemptRows,
    lessonQuizAttemptMap,
    lessonQuizAttemptCountMap,
    completedLessonIds,
    lastAccessedLessonId: resolvedLastAccessedLessonId,
    watchMetrics,
  };
}

function getCompletedLessonSet(snapshot: LearningSnapshot): Set<number> {
  return buildCompletedLessonSet(snapshot.completedLessonIds as Array<number | string>);
}

function assertLessonAccessibleForLearner(snapshot: LearningSnapshot, lessonId: number): {
  lessonIndex: number;
  lesson: any;
  completedLessonSet: Set<number>;
  isUnlocked: boolean;
} {
  return assertTypedLessonAccessibleForLearner(
    snapshot.lessons,
    snapshot.completedLessonIds as Array<number | string>,
    lessonId,
    buildAppError,
  );
}

function buildEnrollmentSummary(snapshot: LearningSnapshot) {
  const totalLessons = snapshot.lessons.length;
  const completionPercent = calculateProgressPercent(snapshot.completedLessonIds.length, totalLessons);

  return {
    totalLessons,
    completionPercent,
    watchPercent: snapshot.watchMetrics.watchPercent,
    isCompleted: totalLessons > 0 && snapshot.completedLessonIds.length >= totalLessons,
  };
}

function normalizeAndValidateCreateVideoQuestion(
  lesson: any,
  data: CreateVideoQuestionInput,
) {
  const duration = Number(lesson.video?.duration ?? 0);
  if (duration > 0 && data.displayAtSeconds > duration) {
    throw buildAppError('เวลาที่แสดงคำถามต้องไม่เกินความยาววิดีโอ', 400);
  }

  return normalizeInteractiveQuestionPayload(data) as CreateVideoQuestionInput;
}

export const coursesService = {
  async listCategories() {
    return await ensureDefaultCategoriesSeeded();
  },

  async listPublicCategories() {
    await ensureDefaultCategoriesSeeded();
    return await coursesRepository.listPublishedCategories();
  },

  async getCategory(id: number) {
    return await coursesRepository.getCategoryById(id);
  },

  async createCategory(data: CreateCategoryInput, adminId?: string, ipAddress?: string) {
    const category = await coursesRepository.createCategory(data);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_CATEGORY',
        targetTable: 'categories',
        newValue: category,
        ipAddress,
      });
    }
    return category;
  },

  async updateCategory(id: number, data: UpdateCategoryInput, adminId?: string, ipAddress?: string) {
    const oldCategory = await coursesRepository.getCategoryById(id);
    const category = await coursesRepository.updateCategory(id, data);
    if (adminId && category) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_CATEGORY',
        targetTable: 'categories',
        oldValue: oldCategory,
        newValue: category,
        ipAddress,
      });
    }
    return category;
  },

  async deleteCategory(id: number, adminId?: string, ipAddress?: string) {
    const usedCount = await coursesRepository.countCoursesByCategory(id);
    if (usedCount > 0) {
      throw buildAppError('ไม่สามารถลบหมวดหมู่ที่มีคอร์สใช้งานอยู่ได้', 409, 'CATEGORY_IN_USE');
    }

    const oldCategory = await coursesRepository.getCategoryById(id);
    const result = await coursesRepository.deleteCategory(id);
    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_CATEGORY',
        targetTable: 'categories',
        oldValue: oldCategory,
        ipAddress,
      });
    }
    return result;
  },

  async listSubcategories(categoryId?: number) {
    return await coursesRepository.listSubcategories(categoryId);
  },

  async getSubcategory(id: number) {
    return await coursesRepository.getSubcategoryById(id);
  },

  async createSubcategory(data: CreateSubcategoryInput, adminId?: string, ipAddress?: string) {
    const subcategory = await coursesRepository.createSubcategory(data);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_SUBCATEGORY',
        targetTable: 'subcategories',
        newValue: subcategory,
        ipAddress,
      });
    }
    return subcategory;
  },

  async updateSubcategory(id: number, data: UpdateSubcategoryInput, adminId?: string, ipAddress?: string) {
    const oldSubcategory = await coursesRepository.getSubcategoryById(id);
    const subcategory = await coursesRepository.updateSubcategory(id, data);
    if (adminId && subcategory) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_SUBCATEGORY',
        targetTable: 'subcategories',
        oldValue: oldSubcategory,
        newValue: subcategory,
        ipAddress,
      });
    }
    return subcategory;
  },

  async deleteSubcategory(id: number, adminId?: string, ipAddress?: string) {
    const usedCount = await coursesRepository.countCoursesBySubcategory(id);
    if (usedCount > 0) {
      throw buildAppError('ไม่สามารถลบหมวดหมู่ย่อยที่มีคอร์สใช้งานอยู่ได้', 409);
    }

    const oldSubcategory = await coursesRepository.getSubcategoryById(id);
    const result = await coursesRepository.deleteSubcategory(id);
    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_SUBCATEGORY',
        targetTable: 'subcategories',
        oldValue: oldSubcategory,
        ipAddress,
      });
    }
    return result;
  },

  async listCourses(filters?: { categoryId?: number; search?: string; limit?: number }) {
    const courseItems = await coursesRepository.listCourses(filters);
    return courseItems.map((course) => normalizeCourseForAdmin(course));
  },

  async listPublishedCourses(filters?: { categoryId?: number; search?: string; limit?: number }, viewer?: CourseAccessUser) {
    const courseItems = await coursesRepository.listPublishedCourses(filters);
    const normalizedCourses = courseItems.map((course) => normalizeCourseForPublic(course));
    return filterVisibleCoursesForViewer(normalizedCourses, viewer);
  },

  async listEnrolledCourses(userId: number, viewer?: CourseAccessUser, status: EnrolledCourseStatusFilter = 'active') {
    const enrolledCourses = await coursesRepository.listEnrolledCourses(userId, status);

    return enrolledCourses.map((enrollment: any) => {
      const course = normalizeCourseThumbnail(enrollment.course || {});
      const completionPercent = Number(enrollment.progressPercent ?? 0);
      const watchPercent = Number(enrollment.watchPercent ?? 0);
      const isCompleted = Boolean(enrollment.isCompleted);
      const enrollmentStatus = normalizeEnrollmentStatus(enrollment.status);
      const refundRequest = normalizeRefundRequestSummary(enrollment.refundRequest);
      const completedAt = isCompleted
        ? enrollment.certificate?.issuedAt ?? enrollment.lastAccessedAt ?? enrollment.enrolledAt
        : null;

      return {
        id: Number(course.id),
        courseId: Number(course.id),
        title: course.title,
        courseTitle: course.title,
        thumbnail: course.thumbnail ?? null,
        authorName: course.authorName ?? null,
        instructor: course.authorName ?? null,
        price: Number(course.price ?? 0),
        cpeCredits: Number(course.cpeCredits ?? 0),
        cpe: Number(course.cpeCredits ?? 0),
        audience: normalizeCourseAudience(course.audience),
        progressPercent: completionPercent,
        progress: completionPercent,
        completionPercent,
        watchPercent,
        status: isCompleted ? 'completed' : 'in_progress',
        enrollmentStatus,
        courseStatus: String(course.status || 'PUBLISHED').toUpperCase(),
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt ?? null,
        lastAccessedLessonId: enrollment.lastAccessedLessonId ?? null,
        completedAt,
        cancelledAt: enrollment.cancelledAt ?? null,
        cancelReason: enrollment.cancelReason ?? null,
        sourceOrderItemId: enrollment.sourceOrderItemId ?? null,
        certificateUrl: null,
        certificateCode: enrollment.certificate?.certificateCode ?? null,
        hasCertificate: Boolean(course.hasCertificate),
        lessonsCount: Number(course.lessonsCount ?? 0),
        refundRequest,
        refundRequestStatus: refundRequest?.status ?? null,
      };
    }).filter((course) => {
      const viewerRole = viewer ? resolveCourseViewerRole(viewer) : 'general';
      return canViewerSeeCourse(course.audience, viewerRole);
    });
  },

  async getCourse(id: number) {
    const course = await coursesRepository.getCourseById(id);
    return course ? normalizeCourseForAdmin(course) : null;
  },

  async getPublishedCourse(id: number, viewer?: CourseAccessUser) {
    const course = await coursesRepository.getPublishedCourseById(id);
    if (!course) {
      return null;
    }

    const normalizedCourse = normalizeCourseForPublic(course);
    const viewerRole = resolveCourseViewerRole(viewer);
    if (viewerRole !== 'guest' && !canViewerSeeCourse(normalizedCourse.audience, viewerRole)) {
      throw buildAppError('คุณไม่มีสิทธิ์เข้าถึงคอร์สนี้', 403, 'COURSE_ROLE_FORBIDDEN');
    }

    return filterVisibleRelatedCourses(normalizedCourse, viewer);
  },

  async getCourseReviews(courseId: number, limit?: number) {
    const stats = await coursesRepository.getCourseReviewStats(courseId);
    const reviews = await coursesRepository.listCourseReviews(courseId, limit ?? 5);
    return {
      reviews: reviews.map((review) => normalizeCourseReview(review)),
      reviewsCount: stats.reviewsCount,
      rating: stats.reviewsCount > 0 ? Number(stats.averageRating.toFixed(1)) : Number(0),
    };
  },

  async getCourseReviewEligibility(courseId: number, userId: number) {
    const enrollment = await coursesRepository.findEnrollment(userId, courseId);
    if (!enrollment) {
      return { canReview: false };
    }
    const hasCompleted = await coursesRepository.hasUserCompletedCourse(userId, courseId);
    return { canReview: hasCompleted };
  },

  async submitCourseReview(courseId: number, userId: number, payload: CreateCourseReviewInput) {
    await getEnrollmentOrThrow(userId, courseId);
    const hasCompleted = await coursesRepository.hasUserCompletedCourse(userId, courseId);
    if (!hasCompleted) {
      throw buildAppError('กรุณาเรียนจบคอร์สก่อนให้คะแนน', 403, 'COURSE_INCOMPLETE');
    }

    const review = await coursesRepository.upsertCourseReview({
      courseId,
      userId,
      rating: payload.rating,
      title: payload.title ?? null,
      body: payload.body ?? null,
    });

    return normalizeCourseReview(review);
  },

  async getCourseLearning(id: number, userId: number, viewer?: CourseAccessUser) {
    const snapshot = await buildLearningSnapshot(id, userId, viewer);
    const completedLessonSet = getCompletedLessonSet(snapshot);
    const lessons = snapshot.lessons.map((lesson: any, index: number) => {
      const lessonId = Number(lesson.id);
      const isCompleted = completedLessonSet.has(lessonId);
      const isUnlocked = isLessonUnlockedByIndex(snapshot.lessons as Array<{ id: number | string }>, index, completedLessonSet);
      const lessonQuizId = Number(lesson.lessonQuiz?.id ?? 0);
      const latestLessonQuizAttempt = lessonQuizId > 0
        ? snapshot.lessonQuizAttemptMap.get(lessonQuizId) ?? null
        : null;
      const lessonQuizAttemptsUsed = lessonQuizId > 0
        ? snapshot.lessonQuizAttemptCountMap.get(lessonQuizId) ?? 0
        : 0;

      if (!isCompleted && !isUnlocked) {
        return buildLockedLessonLearningPayload(lesson);
      }

      const interactiveQuestions = sortInteractiveQuestions(
        Array.isArray(lesson.videoQuestions)
          ? lesson.videoQuestions.map((question: any) => {
              const answer = snapshot.answerMap.get(Number(question.id));
              const answered = isInteractiveQuestionAnswered(question, answer);

              return {
                ...normalizeInteractiveQuestion(question, { includeCorrectAnswer: false }),
                answered,
              };
            })
          : []
      );

      return {
        id: lessonId,
        title: lesson.title,
        sequenceOrder: lesson.sequenceOrder,
        status: isCompleted ? 'completed' : isUnlocked ? 'available' : 'locked',
        video: lesson.video
          ? {
              id: lesson.video.id,
              provider: lesson.video.provider,
              resourceId: lesson.video.resourceId,
              duration: Number(lesson.video.duration ?? 0),
              name: lesson.video.name,
              status: lesson.video.status ?? 'PROCESSING',
              playbackUrl: lesson.video.playbackUrl ?? null,
            }
          : null,
        documents: Array.isArray(lesson.documents)
          ? lesson.documents.map((document: any) => ({
              id: Number(document.id),
              fileName: document.fileName,
              mimeType: document.mimeType,
              sizeBytes: Number(document.sizeBytes ?? 0),
              fileUrl: document.fileUrl,
            }))
          : [],
        interactiveQuestions,
        lessonQuiz: lesson.lessonQuiz
          ? {
              id: Number(lesson.lessonQuiz.id),
              passingScorePercent: Number(lesson.lessonQuiz.passingScorePercent ?? 70),
              maxAttempts: lesson.lessonQuiz.maxAttempts ?? null,
              questionsCount: Array.isArray(lesson.lessonQuiz.questions) ? lesson.lessonQuiz.questions.length : 0,
              attemptsUsed: lessonQuizAttemptsUsed,
              remainingAttempts: lesson.lessonQuiz.maxAttempts
                ? Math.max(0, Number(lesson.lessonQuiz.maxAttempts) - lessonQuizAttemptsUsed)
                : null,
              latestAttempt: normalizeLessonQuizAttemptSummary(latestLessonQuizAttempt, lessonQuizAttemptsUsed),
            }
          : null,
        progress: snapshot.progressMap.get(lessonId)
          ? {
              lastWatchedSeconds: Number(snapshot.progressMap.get(lessonId)?.lastWatchedSeconds ?? 0),
              isCompleted,
            }
          : {
              lastWatchedSeconds: 0,
              isCompleted,
            },
      };
    });

    const completionPercent = calculateProgressPercent(snapshot.completedLessonIds.length, lessons.length);
    const currentLessonId = lessons.find((lesson: { status: string; id: number }) => (
      lesson.id === snapshot.lastAccessedLessonId && lesson.status !== 'locked'
    ))?.id
      ?? lessons.find((lesson: { status: string; id: number }) => lesson.status !== 'locked')?.id
      ?? null;

    return {
      id: Number(snapshot.course.id),
      title: snapshot.course.title,
      description: snapshot.course.description,
      authorName: snapshot.course.authorName,
      thumbnail: snapshot.course.thumbnail,
      audience: normalizeCourseAudience(snapshot.course.audience),
      hasCertificate: Boolean(snapshot.course.hasCertificate),
      cpeCredits: Number(snapshot.course.cpeCredits ?? 0),
      enrolledAt: snapshot.enrollment.enrolledAt,
      lastAccessedAt: snapshot.enrollment.lastAccessedAt ?? snapshot.enrollment.enrolledAt,
      watchPercent: snapshot.watchMetrics.watchPercent,
      completionPercent,
      progressPercent: completionPercent,
      completedLessons: snapshot.completedLessonIds,
      lastAccessedLessonId: snapshot.lastAccessedLessonId,
      currentLessonId,
      lessons,
    };
  },

  async getCourseProgress(id: number, userId: number, viewer?: CourseAccessUser) {
    const snapshot = await buildLearningSnapshot(id, userId, viewer);
    const completionPercent = calculateProgressPercent(snapshot.completedLessonIds.length, snapshot.lessons.length);

    return {
      courseId: Number(snapshot.course.id),
      audience: normalizeCourseAudience(snapshot.course.audience),
      completedLessons: snapshot.completedLessonIds,
      lastAccessedLessonId: snapshot.lastAccessedLessonId ?? undefined,
      watchPercent: snapshot.watchMetrics.watchPercent,
      completionPercent,
      progressPercent: completionPercent,
      startedAt: snapshot.enrollment.enrolledAt,
      lastAccessedAt: snapshot.enrollment.lastAccessedAt ?? snapshot.enrollment.enrolledAt,
    };
  },

  async createCourse(data: CreateCourseInput, adminId?: string, ipAddress?: string) {
    validateThumbnailSizeLimit(data.thumbnail);
    const payload = await sanitizeCourseWriteReferences(normalizeThumbnailForStorage(data));
    validateCourseForStatus(payload);

    const { relatedCourseIds, ...rest } = payload;
    const repositoryPayload = {
      ...rest,
      publishedAt: payload.status === 'PUBLISHED' ? new Date() : undefined,
    };

    const course = await coursesRepository.createCourse(repositoryPayload);
    await withRelatedCourses(course.id, relatedCourseIds);

    const createdCourse = await coursesRepository.getCourseById(course.id);
    if (adminId) {
      void auditLogsService.recordAction({
        adminId,
        action: 'CREATE_COURSE',
        targetTable: 'courses',
        newValue: createdCourse ?? course,
        ipAddress,
      });
    }

    return createdCourse ? normalizeCourseForAdmin(createdCourse) : normalizeCourseThumbnail(course);
  },

  async updateCourse(id: number, data: UpdateCourseInput, adminId?: string, ipAddress?: string) {
    if (typeof data.thumbnail === 'string') {
      validateThumbnailSizeLimit(data.thumbnail);
    }

    const existingCourse = await coursesRepository.getCourseById(id);
    if (!existingCourse) {
      return null;
    }

    const payload = await sanitizeCourseWriteReferences(
      normalizeThumbnailForStorage(data),
      { fallbackCategoryId: Number(existingCourse.categoryId ?? 0) || null },
    );
    const mergedCourse = {
      ...existingCourse,
      ...payload,
      relatedCourseIds: Array.isArray(payload.relatedCourseIds)
        ? payload.relatedCourseIds
        : Array.isArray((existingCourse as any).relatedCourseIds)
          ? (existingCourse as any).relatedCourseIds
          : [],
      lessons: existingCourse.lessons,
      thumbnail: payload.thumbnail === undefined ? existingCourse.thumbnail : payload.thumbnail,
    };

    validateCourseForStatus(mergedCourse);

    const { relatedCourseIds, ...rest } = payload;
    const repositoryPayload = {
      ...rest,
      publishedAt:
        mergedCourse.status === 'PUBLISHED' && !existingCourse.publishedAt
          ? new Date()
          : existingCourse.publishedAt,
    };

    const course = await coursesRepository.updateCourse(id, repositoryPayload);
    await withRelatedCourses(id, relatedCourseIds);

    const updatedCourse = await coursesRepository.getCourseById(id);
    const previewVideoChanged = typeof payload.previewVideoId !== 'undefined' && payload.previewVideoId !== existingCourse.previewVideoId;
    if (previewVideoChanged) {
      await this.cleanupOrphanedVideo(existingCourse.previewVideoId);
    }

    if (adminId && course) {
      void auditLogsService.recordAction({
        adminId,
        action: 'UPDATE_COURSE',
        targetTable: 'courses',
        oldValue: existingCourse,
        newValue: updatedCourse ?? course,
        ipAddress,
      });
    }
    return updatedCourse ? normalizeCourseForAdmin(updatedCourse) : course ? normalizeCourseThumbnail(course) : null;
  },

  async deleteCourse(id: number, adminId?: string, ipAddress?: string) {
    const oldCourse = await coursesRepository.getCourseById(id);
    if (!oldCourse) {
      return null;
    }

    const deletionBlockers = await coursesRepository.getCourseDeletionBlockers(id);
    if (
      deletionBlockers.enrollmentsCount > 0
      || deletionBlockers.certificatesCount > 0
      || deletionBlockers.orderItemsCount > 0
    ) {
      throw buildAppError(
        'ไม่สามารถลบคอร์สที่มีประวัติการสมัครเรียน ใบประกาศนียบัตร หรือคำสั่งซื้อได้ กรุณาเปลี่ยนสถานะเป็น ARCHIVED แทน',
        409,
        'COURSE_DELETE_CONFLICT',
        {
          ...deletionBlockers,
          canHardDelete: false,
          recommendedAdminAction: 'archive',
        }
      );
    }

    const deletionResult = await coursesRepository.deleteCourse(id);
    const result = deletionResult?.course ?? null;

    if (deletionResult?.deletedVideos?.length) {
      void Promise.allSettled(
        deletionResult.deletedVideos
          .filter((video) => video.provider === 'VIMEO')
          .map(async (video) => {
            try {
              await vimeoService.deleteVideo(video.resourceId);
            } catch (error) {
              console.error(`Failed to delete orphaned Vimeo video ${video.id} after deleting course ${id}:`, error);
            }
          })
      );
    }

    if (adminId && result) {
      void auditLogsService.recordAction({
        adminId,
        action: 'DELETE_COURSE',
        targetTable: 'courses',
        oldValue: oldCourse,
        ipAddress,
      });
    }
    return result;
  },

  async cleanupOrphanedVideo(videoId?: number | null) {
    if (!Number.isInteger(videoId)) {
      return null;
    }

    const normalizedVideoId = Number(videoId);
    const usageCount = await coursesRepository.countVideoUsage(normalizedVideoId);
    if (usageCount > 0) {
      return null;
    }

    const video = await coursesRepository.getVideoById(normalizedVideoId);
    if (!video) {
      return null;
    }

    const deletedVideo = await coursesRepository.deleteVideo(video.id);

    if (video.provider === 'VIMEO') {
      try {
        await vimeoService.deleteVideo(video.resourceId);
      } catch (error) {
        console.error(`Failed to delete orphaned Vimeo video ${video.id}:`, error);
      }
    }

    return deletedVideo;
  },

  async listLessons(courseId: number) {
    const lessonItems = await coursesRepository.listLessonsByCourse(courseId);
    return lessonItems.map((lesson) => normalizeLessonForResponse(lesson));
  },

  async createLesson(courseId: number, data: CreateLessonInput) {
    const course = await coursesRepository.getCourseById(courseId);
    if (!course) {
      throw buildAppError('Course not found', 404);
    }

    const video = await coursesRepository.getVideoById(data.videoId);
    if (!video) {
      throw buildAppError('Video not found', 404);
    }

    const lesson = await coursesRepository.createLesson(courseId, data);
    const createdLesson = await coursesRepository.getLessonById(lesson.id);
    return createdLesson ? normalizeLessonForResponse(createdLesson) : lesson;
  },

  async updateLesson(id: number, data: UpdateLessonInput) {
    const existingLesson = await coursesRepository.getLessonById(id);
    if (!existingLesson) {
      return null;
    }

    if (data.videoId) {
      const video = await coursesRepository.getVideoById(data.videoId);
      if (!video) {
        throw buildAppError('Video not found', 404);
      }
    }

    const lesson = await coursesRepository.updateLesson(id, data);
    if (!lesson) {
      return null;
    }

    if (data.videoId && data.videoId !== existingLesson.videoId) {
      await this.cleanupOrphanedVideo(existingLesson.videoId);
    }

    const updatedLesson = await coursesRepository.getLessonById(id);
    return updatedLesson ? normalizeLessonForResponse(updatedLesson) : lesson;
  },

  async deleteLesson(id: number) {
    const lesson = await coursesRepository.getLessonById(id);
    if (!lesson) {
      return null;
    }

    const deletedLesson = await coursesRepository.deleteLesson(id);
    await this.cleanupOrphanedVideo(lesson.videoId);
    return deletedLesson;
  },

  async addLessonDocument(lessonId: number, data: CreateLessonDocumentInput) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const document = await coursesRepository.createLessonDocument(lessonId, data);
    return normalizeLessonDocumentForResponse(document, { includeFileUrl: true });
  },

  async getLessonDocument(id: number) {
    const document = await coursesRepository.getLessonDocumentById(id);
    if (!document) {
      return null;
    }

    return normalizeLessonDocumentForResponse(document, { includeFileUrl: true });
  },

  async deleteLessonDocument(id: number) {
    return await coursesRepository.deleteLessonDocument(id);
  },

  async addVideoQuestion(lessonId: number, data: CreateVideoQuestionInput) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const payload = normalizeAndValidateCreateVideoQuestion(lesson, data);
    return await coursesRepository.createVideoQuestion(lessonId, payload);
  },

  async addVideoQuestionsBulk(lessonId: number, data: CreateVideoQuestionBulkInput) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const questions = Array.isArray(data.questions) ? data.questions : [];
    if (questions.length === 0) {
      throw buildAppError('กรุณาระบุคำถามอย่างน้อย 1 ข้อ', 400);
    }

    const payload = questions.map((question) => normalizeAndValidateCreateVideoQuestion(lesson, question));

    return await coursesRepository.createVideoQuestionsBulk(lessonId, payload);
  },

  async deleteVideoQuestion(id: number) {
    return await coursesRepository.deleteVideoQuestion(id);
  },

  async updateVideoQuestion(id: number, data: UpdateVideoQuestionInput) {
    const question = await coursesRepository.getVideoQuestionById(id);
    if (!question) {
      return null;
    }

    const lessonDuration = Number(question.lesson?.video?.duration ?? 0);
    if (data.displayAtSeconds !== undefined && lessonDuration > 0 && data.displayAtSeconds > lessonDuration) {
      throw buildAppError('เวลาที่แสดงคำถามต้องไม่เกินความยาววิดีโอ', 400);
    }

    const payload = normalizeInteractiveQuestionPayload({
      questionText: data.questionText ?? question.questionText,
      displayAtSeconds: data.displayAtSeconds ?? question.displayAtSeconds,
      sortOrder: data.sortOrder ?? question.sortOrder ?? undefined,
      questionType: data.questionType ?? question.questionType,
      options: Array.isArray(data.options)
        ? data.options
        : Array.isArray(question.options)
          ? question.options as Array<{ id?: string; text: string; isCorrect?: boolean }>
          : undefined,
      correctAnswer: data.correctAnswer ?? question.correctAnswer ?? undefined,
    }) as UpdateVideoQuestionInput;

    return await coursesRepository.updateVideoQuestion(id, payload);
  },

  async answerVideoQuestion(id: number, userId: number, data: CreateVideoQuestionAnswerInput, viewer?: CourseAccessUser) {
    const question = await coursesRepository.getVideoQuestionById(id);
    if (!question) {
      throw buildAppError('Video question not found', 404);
    }

    const courseId = Number(question.lesson?.course?.id);
    const lessonId = Number(question.lesson?.id);
    const courseStatus = String(question.lesson?.course?.status || '').toUpperCase();
    if (!courseId || !lessonId || !['PUBLISHED', 'ARCHIVED'].includes(courseStatus)) {
      throw buildAppError('Course not found', 404);
    }

    const trimmedAnswer = data.answerGiven.trim();
    let canonicalAnswerGiven = trimmedAnswer;

    if (question.questionType === 'MULTIPLE_CHOICE' || question.questionType === 'TRUE_FALSE') {
      const resolvedAnswer = resolveInteractiveChoiceAnswer(
        Array.isArray(question.options) ? question.options : [],
        trimmedAnswer,
      );

      if (!resolvedAnswer) {
        throw buildAppError('คำตอบไม่ถูกต้องตามตัวเลือกที่กำหนด', 400);
      }

      canonicalAnswerGiven = resolvedAnswer;
    }

    return await db.transaction(async (tx) => {
      await coursesRepository.lockEnrollment(userId, courseId, tx);

      const snapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      assertLessonAccessibleForLearner(snapshot, lessonId);

      const answer = await coursesRepository.upsertVideoQuestionAnswer(userId, id, {
        answerGiven: canonicalAnswerGiven,
      }, tx);
      await coursesRepository.touchEnrollment(userId, courseId, lessonId, tx);

      return {
        id: answer.id,
        videoQuestionId: Number(answer.videoQuestionId),
        answerGiven: answer.answerGiven,
        answered: true,
        updatedAt: answer.updatedAt ?? answer.createdAt,
      };
    });
  },

  async updateLessonProgress(id: number, userId: number, data: UpdateLessonProgressInput, viewer?: CourseAccessUser) {
    const lesson = await coursesRepository.getLessonById(id);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const courseId = Number(lesson.courseId);
    return await db.transaction(async (tx) => {
      await coursesRepository.lockEnrollment(userId, courseId, tx);

      const snapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      const { lesson: learningLesson } = assertLessonAccessibleForLearner(snapshot, id);

      const currentProgress = snapshot.progressMap.get(id);
      const duration = Number(learningLesson.video?.duration ?? lesson.video?.duration ?? 0);
      const contiguousIncomingSeconds = assertAllowedWatchedProgressAdvance(
        Number(currentProgress?.lastWatchedSeconds ?? 0),
        data.lastWatchedSeconds,
        duration,
        buildAppError,
        env.LEARNING_ALLOWED_PROGRESS_ADVANCE_SECONDS,
      );
      const nextWatchedSeconds = calculateMonotonicWatchedSeconds(
        Number(currentProgress?.lastWatchedSeconds ?? 0),
        contiguousIncomingSeconds,
        duration,
      );

      const progress = await coursesRepository.upsertLessonProgress(userId, id, {
        lastWatchedSeconds: nextWatchedSeconds,
        isCompleted: Boolean(currentProgress?.isCompleted),
      }, tx);

      const updatedSnapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      const summary = buildEnrollmentSummary(updatedSnapshot);
      await coursesRepository.updateEnrollmentProgress(
        userId,
        courseId,
        summary.completionPercent,
        summary.isCompleted,
        {
          watchPercent: summary.watchPercent,
          lastAccessedLessonId: id,
        },
        tx,
      );

      return progress;
    });
  },

  async completeLesson(courseId: number, lessonId: number, userId: number, viewer?: CourseAccessUser) {
    return await db.transaction(async (tx) => {
      await coursesRepository.lockEnrollment(userId, courseId, tx);

      const snapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      const { lesson } = assertLessonAccessibleForLearner(snapshot, lessonId);
      const currentProgress = snapshot.progressMap.get(lessonId);

      if (currentProgress?.isCompleted) {
        const summary = buildEnrollmentSummary(snapshot);
        await coursesRepository.updateEnrollmentProgress(
          userId,
          courseId,
          summary.completionPercent,
          summary.isCompleted,
          {
            watchPercent: summary.watchPercent,
            lastAccessedLessonId: lessonId,
          },
          tx,
        );

        return {
          lessonId,
          isCompleted: true,
          completionPercent: summary.completionPercent,
          progressPercent: summary.completionPercent,
          updatedAt: currentProgress.updatedAt,
        };
      }

      const watchedSeconds = Number(currentProgress?.lastWatchedSeconds ?? 0);
      const watchThreshold = getLessonWatchThreshold(Number(lesson.video?.duration ?? 0));
      if (watchThreshold > 0 && watchedSeconds < watchThreshold) {
        throw buildAppError('ต้องดูวิดีโอให้จบก่อนจบบทเรียน', 409, 'LESSON_VIDEO_INCOMPLETE');
      }

      const unansweredInteractive = sortInteractiveQuestions(Array.isArray(lesson.videoQuestions) ? lesson.videoQuestions : [])
        .find((question: any) => {
          const answer = snapshot.answerMap.get(Number(question.id));
          return !isInteractiveQuestionAnswered(question, answer);
        });

      if (unansweredInteractive) {
        throw buildAppError('กรุณาตอบคำถาม interactive ให้ครบก่อนจบบทเรียน', 409, 'INTERACTIVE_INCOMPLETE');
      }

      const lessonQuiz = lesson.lessonQuiz ?? null;
      if (lessonQuiz) {
        const lessonQuizId = Number(lessonQuiz.id);
        const lessonQuizAttemptsUsed = snapshot.lessonQuizAttemptCountMap.get(lessonQuizId) ?? 0;
        const latestLessonQuizAttempt = snapshot.lessonQuizAttemptMap.get(lessonQuizId) ?? null;
        if (!latestLessonQuizAttempt?.isPassed) {
          const maxAttempts = Number(lessonQuiz.maxAttempts ?? 0);
          const lessonQuizCode = maxAttempts > 0 && lessonQuizAttemptsUsed >= maxAttempts
            ? 'LESSON_QUIZ_ATTEMPTS_EXHAUSTED'
            : 'LESSON_QUIZ_INCOMPLETE';
          const lessonQuizMessage = lessonQuizCode === 'LESSON_QUIZ_ATTEMPTS_EXHAUSTED'
            ? 'คุณใช้สิทธิ์ทำแบบทดสอบท้ายบทครบแล้วและยังไม่ผ่าน'
            : 'กรุณาทำแบบทดสอบท้ายบทให้ผ่านก่อนจบบทเรียน';

          throw buildAppError(lessonQuizMessage, 409, lessonQuizCode);
        }
      }

      const effectiveWatchedSeconds = Math.max(watchedSeconds, Number(lesson.video?.duration ?? watchedSeconds));
      const progress = await coursesRepository.markLessonCompleted(userId, lessonId, effectiveWatchedSeconds, tx);
      const updatedSnapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      const summary = buildEnrollmentSummary(updatedSnapshot);

      await coursesRepository.updateEnrollmentProgress(
        userId,
        courseId,
        summary.completionPercent,
        summary.isCompleted,
        {
          watchPercent: summary.watchPercent,
          lastAccessedLessonId: lessonId,
        },
        tx,
      );

      return {
        lessonId,
        isCompleted: true,
        completionPercent: summary.completionPercent,
        progressPercent: summary.completionPercent,
        updatedAt: progress.updatedAt,
      };
    });
  },

  async getLessonQuizRuntime(lessonId: number, userId: number, viewer?: CourseAccessUser) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson?.courseId) {
      throw buildAppError('Lesson not found', 404);
    }

    const snapshot = await buildLearningSnapshot(Number(lesson.courseId), userId, viewer);
    const { lesson: accessibleLesson } = assertLessonAccessibleForLearner(snapshot, lessonId);
    const lessonQuiz = accessibleLesson.lessonQuiz ?? null;

    if (!lessonQuiz) {
      throw buildAppError('ยังไม่มีแบบทดสอบท้ายบทสำหรับบทเรียนนี้', 404, 'LESSON_QUIZ_NOT_FOUND');
    }

    assertLessonQuizReadyForLearner(snapshot, accessibleLesson);

    const lessonQuizId = Number(lessonQuiz.id);
    const attemptsUsed = snapshot.lessonQuizAttemptCountMap.get(lessonQuizId) ?? 0;
    const latestAttempt = snapshot.lessonQuizAttemptMap.get(lessonQuizId) ?? null;
    const maxAttempts = Number(lessonQuiz.maxAttempts ?? 0);

    return {
      id: lessonQuizId,
      lessonId: Number(accessibleLesson.id),
      passingScorePercent: Number(lessonQuiz.passingScorePercent ?? 70),
      maxAttempts: lessonQuiz.maxAttempts ?? null,
      attemptsUsed,
      remainingAttempts: maxAttempts > 0 ? Math.max(0, maxAttempts - attemptsUsed) : null,
      latestAttempt: normalizeLessonQuizAttemptSummary(latestAttempt, attemptsUsed),
      questions: Array.isArray(lessonQuiz.questions)
        ? lessonQuiz.questions.map((question: any) => normalizeLessonQuizQuestionForLearner(question))
        : [],
    };
  },

  async submitLessonQuizAttempt(lessonId: number, userId: number, data: CreateLessonQuizAttemptInput, viewer?: CourseAccessUser) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson?.courseId) {
      throw buildAppError('Lesson not found', 404);
    }

    return await db.transaction(async (tx) => {
      const courseId = Number(lesson.courseId);
      await coursesRepository.lockEnrollment(userId, courseId, tx);

      const snapshot = await buildLearningSnapshot(courseId, userId, viewer, tx);
      const { lesson: accessibleLesson } = assertLessonAccessibleForLearner(snapshot, lessonId);
      const lessonQuiz = accessibleLesson.lessonQuiz ?? null;

      if (!lessonQuiz) {
        throw buildAppError('ยังไม่มีแบบทดสอบท้ายบทสำหรับบทเรียนนี้', 404, 'LESSON_QUIZ_NOT_FOUND');
      }

      assertLessonQuizReadyForLearner(snapshot, accessibleLesson);

      const lessonQuizId = Number(lessonQuiz.id);
      const attemptsUsed = snapshot.lessonQuizAttemptCountMap.get(lessonQuizId) ?? 0;
      const maxAttempts = Number(lessonQuiz.maxAttempts ?? 0);
      if (maxAttempts > 0 && attemptsUsed >= maxAttempts) {
        throw buildAppError('คุณใช้สิทธิ์ทำแบบทดสอบท้ายบทครบแล้ว', 409, 'LESSON_QUIZ_ATTEMPTS_EXHAUSTED');
      }

      const quizQuestions = Array.isArray(lessonQuiz.questions) ? lessonQuiz.questions : [];
      if (quizQuestions.length === 0) {
        throw buildAppError('แบบทดสอบท้ายบทนี้ยังไม่มีคำถาม', 400, 'LESSON_QUIZ_EMPTY');
      }

      const answerMap = new Map<number, string>(
        (Array.isArray(data.answers) ? data.answers : []).map((answer) => [Number(answer.questionId), answer.answerGiven.trim()])
      );

      const evaluatedAnswers: Array<{
        questionId: number;
        answerGiven: string;
        isCorrect: boolean;
        pointsEarned: number;
        scoreWeight: number;
      }> = quizQuestions.map((question: any) => {
        const questionId = Number(question.id);
        const rawAnswer = answerMap.get(questionId)?.trim() ?? '';
        if (!rawAnswer) {
          throw buildAppError('กรุณาตอบคำถามให้ครบทุกข้อก่อนส่งแบบทดสอบ', 400, 'LESSON_QUIZ_ANSWER_INCOMPLETE');
        }

        let normalizedAnswer = rawAnswer;
        let normalizedCorrectAnswer = typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : '';

        if (question.questionType === 'MULTIPLE_CHOICE' || question.questionType === 'TRUE_FALSE') {
          const resolvedAnswer = resolveInteractiveChoiceAnswer(
            Array.isArray(question.options) ? question.options : [],
            rawAnswer,
          );

          if (!resolvedAnswer) {
            throw buildAppError('คำตอบไม่ถูกต้องตามตัวเลือกที่กำหนด', 400, 'LESSON_QUIZ_INVALID_OPTION');
          }

          normalizedAnswer = resolvedAnswer;
          normalizedCorrectAnswer = resolveInteractiveChoiceAnswer(
            Array.isArray(question.options) ? question.options : [],
            normalizedCorrectAnswer,
          ) ?? normalizedCorrectAnswer;
        } else {
          normalizedAnswer = normalizeFreeTextAnswer(rawAnswer);
          normalizedCorrectAnswer = normalizeFreeTextAnswer(normalizedCorrectAnswer);
        }

        const isCorrect = normalizedAnswer === normalizedCorrectAnswer;
        const scoreWeight = Number(question.scoreWeight ?? 1);

        return {
          questionId,
          answerGiven: rawAnswer,
          isCorrect,
          pointsEarned: isCorrect ? scoreWeight : 0,
          scoreWeight,
        };
      });

      const scoreObtained = evaluatedAnswers.reduce((total, answer) => total + answer.pointsEarned, 0);
      const totalScore = evaluatedAnswers.reduce((total, answer) => total + answer.scoreWeight, 0);
      const scorePercent = totalScore > 0 ? Number(((scoreObtained / totalScore) * 100).toFixed(2)) : 0;
      const isPassed = scorePercent >= Number(lessonQuiz.passingScorePercent ?? 70);

      const attempt = await coursesRepository.createLessonQuizAttempt(
        userId,
        lessonQuizId,
        {
          scoreObtained,
          totalScore,
          scorePercent,
          isPassed,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
        tx,
      );

      await coursesRepository.createLessonQuizAnswers(
        Number(attempt.id),
        evaluatedAnswers.map((answer) => ({
          lessonQuizQuestionId: answer.questionId,
          answerGiven: answer.answerGiven,
          isCorrect: answer.isCorrect,
          pointsEarned: answer.pointsEarned,
        })),
        tx,
      );

      await coursesRepository.touchEnrollment(userId, courseId, lessonId, tx);

      const nextAttemptCount = attemptsUsed + 1;

      return {
        attemptId: Number(attempt.id),
        quizId: lessonQuizId,
        lessonId,
        attemptNumber: nextAttemptCount,
        maxAttempts: lessonQuiz.maxAttempts ?? null,
        attemptsUsed: nextAttemptCount,
        remainingAttempts: maxAttempts > 0 ? Math.max(0, maxAttempts - nextAttemptCount) : null,
        scoreObtained,
        totalScore,
        scorePercent,
        isPassed,
        finishedAt: attempt.finishedAt ?? null,
        answers: evaluatedAnswers.map((answer) => ({
          questionId: answer.questionId,
          answerGiven: answer.answerGiven,
          isCorrect: answer.isCorrect,
          pointsEarned: answer.pointsEarned,
        })),
      };
    });
  },

  async getLessonQuiz(lessonId: number) {
    return await coursesRepository.getLessonQuizByLessonId(lessonId);
  },

  async upsertLessonQuiz(lessonId: number, data: CreateLessonQuizInput | UpdateLessonQuizInput) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const existingQuiz = await coursesRepository.getLessonQuizByLessonId(lessonId);
    const quiz = existingQuiz
      ? await coursesRepository.updateLessonQuiz(existingQuiz.id, data)
      : await coursesRepository.createLessonQuiz(lessonId, data as CreateLessonQuizInput);

    const questions = Array.isArray(data.questions) ? data.questions : undefined;
    if (questions) {
      await coursesRepository.replaceLessonQuizQuestions(quiz.id, questions);
    }

    return await coursesRepository.getLessonQuizByLessonId(lessonId);
  },

  async createLessonQuizQuestion(quizId: number, data: CreateLessonQuizQuestionInput) {
    return await coursesRepository.createLessonQuizQuestion(quizId, data);
  },

  async updateLessonQuizQuestion(id: number, data: UpdateLessonQuizQuestionInput) {
    return await coursesRepository.updateLessonQuizQuestion(id, data);
  },

  async deleteLessonQuizQuestion(id: number) {
    return await coursesRepository.deleteLessonQuizQuestion(id);
  },

  async replaceRelatedCourses(id: number, data: UpdateCourseRelatedInput) {
    const course = await coursesRepository.getCourseById(id);
    if (!course) {
      return null;
    }

    await coursesRepository.replaceRelatedCourses(id, data.relatedCourseIds);
    const updatedCourse = await coursesRepository.getCourseById(id);
    return updatedCourse ? normalizeCourseForAdmin(updatedCourse) : null;
  },

  async getExam(courseId: number) {
    return await coursesRepository.getExamByCourseId(courseId);
  },

  async saveExam(courseId: number, data: CreateExamInput) {
    const course = await coursesRepository.getCourseById(courseId);
    if (!course) {
      throw buildAppError('Course not found', 404);
    }

    const existingExam = await coursesRepository.getExamByCourseId(courseId);
    if (existingExam) {
      return await coursesRepository.updateExam(existingExam.id, data);
    }

    return await coursesRepository.createExam(courseId, data);
  },

  async updateExam(id: number, data: UpdateExamInput) {
    return await coursesRepository.updateExam(id, data);
  },

  async deleteExam(id: number) {
    return await coursesRepository.deleteExam(id);
  },

  async addExamQuestion(examId: number, data: CreateExamQuestionInput) {
    return await coursesRepository.createExamQuestion(examId, data);
  },

  async updateExamQuestion(id: number, data: UpdateExamQuestionInput) {
    return await coursesRepository.updateExamQuestion(id, data);
  },

  async deleteExamQuestion(id: number) {
    return await coursesRepository.deleteExamQuestion(id);
  },

  async initiateVideoUpload(data: CreateVideoUploadInitiateInput) {
    try {
      return await vimeoService.initiateTusUpload({
        fileName: data.fileName,
        fileSize: data.fileSize,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw buildAppError('ไม่สามารถเริ่มต้นอัปโหลดวิดีโอไปยัง Vimeo ได้', 502, 'VIMEO_INITIATE_FAILED');
    }
  },

  async listVideos(filters?: VideoListFilters) {
    const result = await coursesRepository.listVideos(filters);
    return {
      ...result,
      videos: result.videos.map((video) => normalizeVideoForResponse(video)),
    };
  },

  async getVideo(id: number) {
    const video = await coursesRepository.getVideoWithUsage(id);
    return video ? normalizeVideoForResponse(video) : null;
  },

  async completeVideoUpload(data: CompleteVideoUploadInput) {
    const existingVideo = await coursesRepository.getVideoByResourceId(data.provider, data.resourceId);
    try {
      const metadata = await vimeoService.waitForVideoMetadata(data.videoUri || data.resourceId);
      const status = deriveVideoStatus(metadata.uploadStatus, metadata.transcodeStatus, metadata.duration, metadata.playbackUrl);

      if (status !== 'FAILED') {
        await vimeoService.ensureEmbedDomains(metadata.resourceId);
      }

      const video = await coursesRepository.createVideo({
        ...data,
        resourceId: metadata.resourceId,
        duration: metadata.duration ?? data.duration ?? 0,
        name: data.name || metadata.name || `Vimeo Video ${metadata.resourceId}`,
        playbackUrl: metadata.playbackUrl,
        status,
      });
      const persistedVideo = await coursesRepository.getVideoWithUsage(video.id);
      return {
        ...normalizeVideoForResponse(persistedVideo ?? video),
        uploadStatus: metadata.uploadStatus,
        transcodeStatus: metadata.transcodeStatus,
      };
    } catch (error) {
      if (existingVideo && shouldMarkVideoFailed(error)) {
        await coursesRepository.updateVideoStatus(existingVideo.id, 'FAILED');
      } else if (!existingVideo && shouldMarkVideoFailed(error)) {
        await coursesRepository.createVideo({
          ...data,
          duration: data.duration ?? 0,
          status: 'FAILED',
        });
      }
      if (error instanceof Error) {
        throw error;
      }
      throw buildAppError('บันทึกวิดีโอจาก Vimeo ไม่สำเร็จ', 502, 'VIMEO_COMPLETE_FAILED');
    }
  },

  async deleteVideo(id: number) {
    const usageCount = await coursesRepository.countVideoUsage(id);
    if (usageCount > 0) {
      throw buildAppError('ไม่สามารถลบวิดีโอที่กำลังถูกใช้งานได้', 409, 'VIDEO_IN_USE');
    }

    const video = await coursesRepository.getVideoById(id);
    if (!video) {
      return null;
    }

    const deletedVideo = await coursesRepository.deleteVideo(id);

    if (video.provider === 'VIMEO') {
      try {
        await vimeoService.deleteVideo(video.resourceId);
      } catch (error) {
        console.error(`Failed to delete Vimeo asset for video ${id}:`, error);
      }
    }

    return deletedVideo;
  },

  async resolveVimeoVideo(data: ResolveVimeoVideoInput) {
    const input = data.resourceId || data.url || '';
    try {
      return await vimeoService.resolveVideo(input);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw buildAppError('ไม่สามารถตรวจสอบวิดีโอจาก Vimeo ได้', 502, 'VIMEO_RESOLVE_FAILED');
    }
  },

  async importVimeoVideo(data: ImportVimeoVideoInput) {
    const input = data.resourceId || data.url || '';
    const resolvedResourceId = data.resourceId || vimeoService.parseVimeoUrl(data.url || '');
    const existingVideo = resolvedResourceId
      ? await coursesRepository.getVideoByResourceId('VIMEO', resolvedResourceId)
      : null;
    try {
      const resolved = await vimeoService.resolveVideo(input);
      const status = deriveVideoStatus(resolved.uploadStatus, resolved.transcodeStatus, resolved.duration, resolved.playbackUrl);

      if (status !== 'FAILED') {
        await vimeoService.ensureEmbedDomains(resolved.resourceId);
      }

      const video = await coursesRepository.createVideo({
        uploadSessionId: `vimeo_import_${resolved.resourceId}_${Date.now()}`,
        name: data.name || resolved.name || `Vimeo Video ${resolved.resourceId}`,
        provider: 'VIMEO',
        resourceId: resolved.resourceId,
        duration: resolved.duration ?? 0,
        playbackUrl: resolved.playbackUrl,
        status,
      });

      return {
        ...normalizeVideoForResponse((await coursesRepository.getVideoWithUsage(video.id)) ?? video),
        videoUri: resolved.videoUri,
        uploadStatus: resolved.uploadStatus,
        transcodeStatus: resolved.transcodeStatus,
      };
    } catch (error) {
      if (existingVideo && shouldMarkVideoFailed(error)) {
        await coursesRepository.updateVideoStatus(existingVideo.id, 'FAILED');
      } else if (resolvedResourceId && shouldMarkVideoFailed(error)) {
        await coursesRepository.createVideo({
          uploadSessionId: `vimeo_import_failed_${resolvedResourceId}_${Date.now()}`,
          name: data.name || `Vimeo Video ${resolvedResourceId}`,
          provider: 'VIMEO',
          resourceId: resolvedResourceId,
          duration: 0,
          status: 'FAILED',
        });
      }
      if (error instanceof Error) {
        throw error;
      }
      throw buildAppError('นำเข้าวิดีโอจาก Vimeo ไม่สำเร็จ', 502, 'VIMEO_IMPORT_FAILED');
    }
  },

  async syncVideoStatus(id: number) {
    const video = await coursesRepository.getVideoById(id);
    if (!video) {
      return null;
    }

    if (video.provider !== 'VIMEO') {
      const persistedVideo = await coursesRepository.getVideoWithUsage(id);
      return persistedVideo ? normalizeVideoForResponse(persistedVideo) : normalizeVideoForResponse(video);
    }

    try {
      const metadata = await vimeoService.getVideoMetadata(video.resourceId);
      const status = deriveVideoStatus(metadata.uploadStatus, metadata.transcodeStatus, metadata.duration, metadata.playbackUrl);

      if (status !== 'FAILED') {
        await vimeoService.ensureEmbedDomains(video.resourceId);
      }

      await coursesRepository.updateVideoStatus(id, status, {
        duration: metadata.duration ?? undefined,
        name: metadata.name ?? undefined,
        playbackUrl: metadata.playbackUrl ?? undefined,
      });

      const persistedVideo = await coursesRepository.getVideoWithUsage(id);
      return persistedVideo
        ? normalizeVideoForResponse(persistedVideo)
        : normalizeVideoForResponse({
            ...video,
            duration: metadata.duration ?? video.duration,
            name: metadata.name ?? video.name,
            playbackUrl: metadata.playbackUrl ?? video.playbackUrl,
            status,
          });
    } catch (error) {
      if (shouldMarkVideoFailed(error)) {
        await coursesRepository.updateVideoStatus(id, 'FAILED');
        const failedVideo = await coursesRepository.getVideoWithUsage(id);
        return failedVideo ? normalizeVideoForResponse(failedVideo) : normalizeVideoForResponse({ ...video, status: 'FAILED' });
      }

      if (error instanceof Error) {
        throw error;
      }

      throw buildAppError('ซิงก์สถานะวิดีโอจาก Vimeo ไม่สำเร็จ', 502, 'VIMEO_METADATA_FAILED');
    }
  },

  async enrollCourse(courseId: number, userId: number, viewer?: CourseAccessUser) {
    const course = await coursesRepository.getPublishedCourseById(courseId);
    if (!course) {
      throw buildAppError('Course not found', 404);
    }

    assertViewerCanAccessCourseOrThrow(normalizeCourseForAdmin(course), viewer);

    const existingEnrollment = await coursesRepository.findEnrollment(userId, courseId);
    if (existingEnrollment) {
      const enrollmentStatus = normalizeEnrollmentStatus(existingEnrollment.status);
      if (enrollmentStatus === 'ACTIVE') {
        return existingEnrollment;
      }

      if (enrollmentStatus === 'CANCELLED') {
        if (Number(course.price ?? 0) > 0) {
          throw buildAppError('คอร์สนี้ถูกยกเลิกไปแล้ว หากต้องการเรียนอีกครั้งกรุณาซื้อใหม่', 409, 'COURSE_REPURCHASE_REQUIRED');
        }

        const reactivatedEnrollment = await coursesRepository.reactivateEnrollment(userId, courseId);
        if (!reactivatedEnrollment) {
          throw buildAppError('ไม่สามารถลงเรียนคอร์สนี้อีกครั้งได้', 500, 'COURSE_REENROLL_FAILED');
        }

        return reactivatedEnrollment;
      }

      const refundRequest = await coursesRepository.getRefundRequestByEnrollmentId(Number(existingEnrollment.id));
      throw buildEnrollmentInactiveError(enrollmentStatus, normalizeRefundRequestStatus(refundRequest?.status));
    }

    const maxStudents = course.maxStudents ? Number(course.maxStudents) : null;
    if (maxStudents !== null) {
      const enrolledCount = await coursesRepository.countEnrollments(courseId);
      if (enrolledCount >= maxStudents) {
        throw buildAppError('Course is full', 409, 'COURSE_FULL');
      }
    }

    const paidOrderItem = await coursesRepository.findLatestPaidOrderItemForUserCourse(userId, courseId);
    return await coursesRepository.createEnrollment(userId, courseId, paidOrderItem?.orderItemId ?? null);
  },

  async cancelCourse(courseId: number, userId: number, data: CancelCourseInput, viewer?: CourseAccessUser) {
    const course = await getLearnerAccessibleCourseOrThrow(courseId, userId, viewer);
    const existingEnrollment = await coursesRepository.findEnrollment(userId, courseId);

    if (!existingEnrollment) {
      throw buildAppError('ยังไม่ได้ลงเรียนคอร์สนี้', 404, 'COURSE_NOT_ENROLLED');
    }

    const enrollmentStatus = normalizeEnrollmentStatus(existingEnrollment.status);
    if (enrollmentStatus !== 'ACTIVE') {
      const refundRequest = await coursesRepository.getRefundRequestByEnrollmentId(Number(existingEnrollment.id));
      throw buildEnrollmentInactiveError(enrollmentStatus, normalizeRefundRequestStatus(refundRequest?.status));
    }

    const certificate = await coursesRepository.findCertificate(userId, courseId);
    if (Boolean(existingEnrollment.isCompleted) || certificate) {
      throw buildAppError('คอร์สที่เรียนจบแล้วหรือมีใบประกาศแล้วไม่สามารถยกเลิกได้', 409, 'COURSE_CANCEL_NOT_ALLOWED');
    }

    const reason = data.reason?.trim() || null;
    const isPaidCourse = Number(course.price ?? 0) > 0;

    return await db.transaction(async (tx) => {
      await coursesRepository.lockEnrollment(userId, courseId, tx);

      const lockedEnrollment = await coursesRepository.findEnrollmentByStatus(userId, courseId, ['ACTIVE'], tx);
      if (!lockedEnrollment) {
        const inactiveEnrollment = await coursesRepository.findEnrollment(userId, courseId, tx);
        if (!inactiveEnrollment) {
          throw buildAppError('ยังไม่ได้ลงเรียนคอร์สนี้', 404, 'COURSE_NOT_ENROLLED');
        }

        const refundRequest = await coursesRepository.getRefundRequestByEnrollmentId(Number(inactiveEnrollment.id), tx);
        throw buildEnrollmentInactiveError(
          normalizeEnrollmentStatus(inactiveEnrollment.status),
          normalizeRefundRequestStatus(refundRequest?.status),
        );
      }

      const latestPaidOrderItem = lockedEnrollment.sourceOrderItemId
        ? { orderItemId: Number(lockedEnrollment.sourceOrderItemId) }
        : await coursesRepository.findLatestPaidOrderItemForUserCourse(userId, courseId, tx);

      if (lockedEnrollment.sourceOrderItemId == null && latestPaidOrderItem?.orderItemId) {
        await coursesRepository.attachEnrollmentSourceOrderItem(Number(lockedEnrollment.id), Number(latestPaidOrderItem.orderItemId), tx);
      }

      if (!isPaidCourse) {
        const cancelledEnrollment = await coursesRepository.updateEnrollmentStatus(
          userId,
          courseId,
          'CANCELLED',
          {
            cancelledAt: new Date(),
            cancelReason: reason,
            sourceOrderItemId: latestPaidOrderItem?.orderItemId ?? lockedEnrollment.sourceOrderItemId ?? null,
            lastAccessedAt: new Date(),
          },
          tx,
        );

        return {
          enrollmentId: Number(cancelledEnrollment?.id ?? lockedEnrollment.id),
          courseId,
          enrollmentStatus: 'CANCELLED',
          cancelledAt: cancelledEnrollment?.cancelledAt ?? new Date().toISOString(),
          cancelReason: reason,
          refundRequest: null,
        };
      }

      const refundPendingEnrollment = await coursesRepository.updateEnrollmentStatus(
        userId,
        courseId,
        'REFUND_PENDING',
        {
          cancelledAt: new Date(),
          cancelReason: reason,
          sourceOrderItemId: latestPaidOrderItem?.orderItemId ?? lockedEnrollment.sourceOrderItemId ?? null,
          lastAccessedAt: new Date(),
        },
        tx,
      );

      const refundRequest = await coursesRepository.upsertCourseRefundRequest({
        userId,
        courseId,
        enrollmentId: Number(refundPendingEnrollment?.id ?? lockedEnrollment.id),
        orderItemId: latestPaidOrderItem?.orderItemId ?? lockedEnrollment.sourceOrderItemId ?? null,
        status: 'PENDING',
        reason,
        requestedAt: new Date(),
      }, tx);

      return {
        enrollmentId: Number(refundPendingEnrollment?.id ?? lockedEnrollment.id),
        courseId,
        enrollmentStatus: 'REFUND_PENDING',
        cancelledAt: refundPendingEnrollment?.cancelledAt ?? new Date().toISOString(),
        cancelReason: reason,
        refundRequest: normalizeRefundRequestSummary(refundRequest),
      };
    });
  },

  async listRefundRequests() {
    const refundRequests = await coursesRepository.listRefundRequests();
    return refundRequests.map((request: any) => ({
      id: Number(request.id),
      status: normalizeRefundRequestStatus(request.status) ?? 'PENDING',
      reason: request.reason ?? null,
      adminNote: request.adminNote ?? null,
      requestedAt: request.requestedAt ?? null,
      resolvedAt: request.resolvedAt ?? null,
      resolvedByAdminId: request.resolvedByAdminId ?? null,
      enrollmentId: Number(request.enrollmentId),
      courseId: Number(request.courseId),
      courseTitle: request.courseTitle ?? '',
      coursePrice: Number(request.coursePrice ?? 0),
      orderItemId: request.orderItemId ?? null,
      orderId: request.orderId ?? null,
      user: {
        id: Number(request.userId),
        fullName: request.userName ?? '',
        email: request.userEmail ?? '',
      },
    }));
  },

  async resolveRefundRequest(
    refundRequestId: number,
    status: 'APPROVED' | 'REJECTED',
    data: ResolveRefundRequestInput,
    adminId?: string,
  ) {
    const refundRequest = await coursesRepository.getRefundRequestById(refundRequestId);
    if (!refundRequest) {
      throw buildAppError('ไม่พบคำขอคืนเงินนี้', 404, 'REFUND_REQUEST_NOT_FOUND');
    }

    if (normalizeRefundRequestStatus(refundRequest.status) !== 'PENDING') {
      throw buildAppError('คำขอคืนเงินนี้ถูกดำเนินการไปแล้ว', 409, 'REFUND_REQUEST_ALREADY_RESOLVED');
    }

    const resolvedRefundRequest = await db.transaction(async (tx) => {
      const updatedRefundRequest = await coursesRepository.resolveRefundRequest(
        refundRequestId,
        status,
        {
          adminNote: data.adminNote?.trim() || null,
          resolvedAt: new Date(),
          resolvedByAdminId: adminId ?? null,
        },
        tx,
      );

      if (!updatedRefundRequest) {
        throw buildAppError('ไม่พบคำขอคืนเงินนี้', 404, 'REFUND_REQUEST_NOT_FOUND');
      }

      if (status === 'APPROVED' && updatedRefundRequest.orderItemId) {
        const paidOrderItem = await coursesRepository.getOrderItemById(Number(updatedRefundRequest.orderItemId), tx);
        const orderId = Number(paidOrderItem?.orderId ?? 0);
        if (orderId > 0) {
          const [orderItemsCount, approvedRefundCount] = await Promise.all([
            coursesRepository.countOrderItemsForOrder(orderId, tx),
            coursesRepository.countApprovedRefundRequestsForOrder(orderId, tx),
          ]);

          if (orderItemsCount > 0 && approvedRefundCount >= orderItemsCount) {
            await coursesRepository.updateOrderStatus(orderId, 'REFUNDED', tx);
          }
        }
      }

      return updatedRefundRequest;
    });

    return normalizeRefundRequestSummary(resolvedRefundRequest);
  },
};
