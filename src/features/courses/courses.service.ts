import { coursesRepository } from './courses.repository.js';
import { auditLogsService } from '../audit-logs/audit-logs.service.js';
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
  CreateExamInput,
  UpdateExamInput,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
  CreateVideoUploadInitiateInput,
  CompleteVideoUploadInput,
  ResolveVimeoVideoInput,
  ImportVimeoVideoInput,
} from './courses.schema.js';

type LearningSnapshot = Awaited<ReturnType<typeof buildLearningSnapshot>>;

type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

function buildAppError(message: string, statusCode = 400, code?: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
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
    documents: Array.isArray(lesson.documents) ? lesson.documents : [],
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
            thumbnail: relatedCourse.thumbnail,
            authorName: relatedCourse.authorName,
            enrolledCount: relatedCourse.enrolledCount ?? relatedCourse.enrollmentsCount ?? 0,
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

  if (!courseLike.maxStudents || Number(courseLike.maxStudents) <= 0) {
    throw buildAppError('กรุณาระบุจำนวนรับมากกว่า 0 ก่อนเผยแพร่', 400);
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

function calculateProgressPercent(completedLessons: number, totalLessons: number) {
  if (totalLessons <= 0) {
    return 0;
  }

  return Number(((completedLessons / totalLessons) * 100).toFixed(2));
}

function getLessonWatchThreshold(duration?: number | null) {
  if (!duration || duration <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(duration));
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
    return {
      ...data,
      questionText,
      options: buildTrueFalseOptions(),
      correctAnswer: null,
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

async function getPublishedCourseForLearnerOrThrow(courseId: number) {
  const course = await coursesRepository.getPublishedCourseById(courseId);
  if (!course) {
    throw buildAppError('Course not found', 404);
  }

  return normalizeCourseForAdmin(course);
}

async function getEnrollmentOrThrow(userId: number, courseId: number) {
  const enrollment = await coursesRepository.findEnrollment(userId, courseId);
  if (!enrollment) {
    throw buildAppError('กรุณาสมัครเรียนก่อนเข้าดูเนื้อหา', 403, 'COURSE_NOT_ENROLLED');
  }

  return enrollment;
}

async function buildLearningSnapshot(courseId: number, userId: number) {
  const course = await getPublishedCourseForLearnerOrThrow(courseId);
  const enrollment = await getEnrollmentOrThrow(userId, courseId);

  const lessons = Array.isArray(course.lessons) ? course.lessons.map((lesson: any) => normalizeLessonForResponse(lesson)) : [];
  const lessonIds = lessons.map((lesson: any) => Number(lesson.id));
  const questionIds = lessons.flatMap((lesson: any) =>
    Array.isArray(lesson.videoQuestions) ? lesson.videoQuestions.map((question: any) => Number(question.id)) : []
  );

  const [progressRows, answerRows] = await Promise.all([
    coursesRepository.listUserLessonProgress(userId, lessonIds),
    coursesRepository.listUserVideoAnswers(userId, questionIds),
  ]);

  const progressMap = new Map(progressRows.map((row) => [Number(row.lessonId), row]));
  const answerMap = new Map(
    answerRows
      .filter((row) => row.videoQuestionId !== null)
      .map((row) => [Number(row.videoQuestionId), row])
  );

  const completedLessonIds = lessons
    .filter((lesson: any) => Boolean(progressMap.get(Number(lesson.id))?.isCompleted))
    .map((lesson: any) => Number(lesson.id));

  const lastAccessedProgress = [...progressRows].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  })[0];

  return {
    course,
    enrollment,
    lessons,
    progressRows,
    progressMap,
    answerRows,
    answerMap,
    completedLessonIds,
    lastAccessedLessonId: lastAccessedProgress ? Number(lastAccessedProgress.lessonId) : null,
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

function normalizeAndValidateCreateVideoQuestion(
  lesson: any,
  data: CreateVideoQuestionInput,
  fallbackSortOrder?: number,
) {
  const duration = Number(lesson.video?.duration ?? 0);
  if (duration > 0 && data.displayAtSeconds > duration) {
    throw buildAppError('เวลาที่แสดงคำถามต้องไม่เกินความยาววิดีโอ', 400);
  }

  return normalizeInteractiveQuestionPayload({
    ...data,
    sortOrder: data.sortOrder ?? fallbackSortOrder,
  }) as CreateVideoQuestionInput;
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

  async listPublishedCourses(filters?: { categoryId?: number; search?: string; limit?: number }) {
    const courseItems = await coursesRepository.listPublishedCourses(filters);
    return courseItems.map((course) => normalizeCourseForPublic(course));
  },

  async listEnrolledCourses(userId: number) {
    const enrolledCourses = await coursesRepository.listEnrolledCourses(userId);

    return enrolledCourses.map((enrollment: any) => {
      const course = normalizeCourseThumbnail(enrollment.course || {});
      const progressPercent = Number(enrollment.progressPercent ?? 0);
      const isCompleted = Boolean(enrollment.isCompleted);
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
        cpeCredits: Number(course.cpeCredits ?? 0),
        cpe: Number(course.cpeCredits ?? 0),
        progressPercent,
        progress: progressPercent,
        status: isCompleted ? 'completed' : 'in_progress',
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt ?? null,
        completedAt,
        certificateUrl: null,
        certificateCode: enrollment.certificate?.certificateCode ?? null,
        hasCertificate: Boolean(course.hasCertificate),
        lessonsCount: Number(course.lessonsCount ?? 0),
      };
    });
  },

  async getCourse(id: number) {
    const course = await coursesRepository.getCourseById(id);
    return course ? normalizeCourseForAdmin(course) : null;
  },

  async getPublishedCourse(id: number) {
    const course = await coursesRepository.getPublishedCourseById(id);
    return course ? normalizeCourseForPublic(course) : null;
  },

  async getCourseLearning(id: number, userId: number) {
    const snapshot = await buildLearningSnapshot(id, userId);
    const completedLessonSet = getCompletedLessonSet(snapshot);
    const lessons = snapshot.lessons.map((lesson: any, index: number) => {
      const lessonId = Number(lesson.id);
      const isCompleted = completedLessonSet.has(lessonId);
      const isUnlocked = isLessonUnlockedByIndex(snapshot.lessons as Array<{ id: number | string }>, index, completedLessonSet);

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

    const progressPercent = calculateProgressPercent(snapshot.completedLessonIds.length, lessons.length);
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
      hasCertificate: Boolean(snapshot.course.hasCertificate),
      cpeCredits: Number(snapshot.course.cpeCredits ?? 0),
      enrolledAt: snapshot.enrollment.enrolledAt,
      lastAccessedAt: snapshot.enrollment.lastAccessedAt ?? snapshot.enrollment.enrolledAt,
      progressPercent,
      completedLessons: snapshot.completedLessonIds,
      lastAccessedLessonId: snapshot.lastAccessedLessonId,
      currentLessonId,
      lessons,
    };
  },

  async getCourseProgress(id: number, userId: number) {
    const snapshot = await buildLearningSnapshot(id, userId);
    const progressPercent = calculateProgressPercent(snapshot.completedLessonIds.length, snapshot.lessons.length);

    return {
      courseId: Number(snapshot.course.id),
      completedLessons: snapshot.completedLessonIds,
      lastAccessedLessonId: snapshot.lastAccessedLessonId ?? undefined,
      progressPercent,
      startedAt: snapshot.enrollment.enrolledAt,
      lastAccessedAt: snapshot.enrollment.lastAccessedAt ?? snapshot.enrollment.enrolledAt,
    };
  },

  async createCourse(data: CreateCourseInput, adminId?: string, ipAddress?: string) {
    validateThumbnailSizeLimit(data.thumbnail);
    const payload = normalizeThumbnailForStorage(data);
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

    const payload = normalizeThumbnailForStorage(data);
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
    const result = await coursesRepository.deleteCourse(id);
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

    const updatedLesson = await coursesRepository.getLessonById(id);
    return updatedLesson ? normalizeLessonForResponse(updatedLesson) : lesson;
  },

  async deleteLesson(id: number) {
    return await coursesRepository.deleteLesson(id);
  },

  async addLessonDocument(lessonId: number, data: CreateLessonDocumentInput) {
    const lesson = await coursesRepository.getLessonById(lessonId);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    return await coursesRepository.createLessonDocument(lessonId, data);
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

    let nextSortOrder = await coursesRepository.getNextVideoQuestionSortOrder(lessonId);
    const payload = questions.map((question) => {
      const normalizedQuestion = normalizeAndValidateCreateVideoQuestion(
        lesson,
        question,
        question.sortOrder ?? nextSortOrder,
      );

      if (question.sortOrder === undefined) {
        nextSortOrder += 1;
      }

      return normalizedQuestion;
    });

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

  async answerVideoQuestion(id: number, userId: number, data: CreateVideoQuestionAnswerInput) {
    const question = await coursesRepository.getVideoQuestionById(id);
    if (!question) {
      throw buildAppError('Video question not found', 404);
    }

    const courseId = Number(question.lesson?.course?.id);
    if (!courseId || question.lesson?.course?.status !== 'PUBLISHED') {
      throw buildAppError('Course not found', 404);
    }

    const snapshot = await buildLearningSnapshot(courseId, userId);
    assertLessonAccessibleForLearner(snapshot, Number(question.lesson?.id));

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

    const answer = await coursesRepository.upsertVideoQuestionAnswer(userId, id, {
      answerGiven: canonicalAnswerGiven,
    });
    await coursesRepository.touchEnrollment(userId, courseId);

    return {
      id: answer.id,
      videoQuestionId: Number(answer.videoQuestionId),
      answerGiven: answer.answerGiven,
      answered: true,
      updatedAt: answer.updatedAt ?? answer.createdAt,
    };
  },

  async updateLessonProgress(id: number, userId: number, data: UpdateLessonProgressInput) {
    const lesson = await coursesRepository.getLessonById(id);
    if (!lesson) {
      throw buildAppError('Lesson not found', 404);
    }

    const courseId = Number(lesson.courseId);
    const snapshot = await buildLearningSnapshot(courseId, userId);
    const { lesson: learningLesson } = assertLessonAccessibleForLearner(snapshot, id);

    const currentProgress = snapshot.progressMap.get(id);
    const duration = Number(learningLesson.video?.duration ?? lesson.video?.duration ?? 0);
    const contiguousIncomingSeconds = assertAllowedWatchedProgressAdvance(
      Number(currentProgress?.lastWatchedSeconds ?? 0),
      data.lastWatchedSeconds,
      duration,
      buildAppError,
    );
    const nextWatchedSeconds = calculateMonotonicWatchedSeconds(
      Number(currentProgress?.lastWatchedSeconds ?? 0),
      contiguousIncomingSeconds,
      duration,
    );

    const progress = await coursesRepository.upsertLessonProgress(userId, id, {
      lastWatchedSeconds: nextWatchedSeconds,
      isCompleted: Boolean(currentProgress?.isCompleted),
    });

    const totalLessons = snapshot.lessons.length;
    const progressRows = await coursesRepository.listUserLessonProgress(
      userId,
      snapshot.lessons.map((lessonItem: any) => Number(lessonItem.id))
    );
    const completedCount = progressRows.filter((row) => row.isCompleted).length;
    await coursesRepository.updateEnrollmentProgress(
      userId,
      courseId,
      calculateProgressPercent(completedCount, totalLessons),
      totalLessons > 0 && completedCount >= totalLessons
    );

    return progress;
  },

  async completeLesson(courseId: number, lessonId: number, userId: number) {
    const snapshot = await buildLearningSnapshot(courseId, userId);
    const { lesson } = assertLessonAccessibleForLearner(snapshot, lessonId);
    const currentProgress = snapshot.progressMap.get(lessonId);
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

    const effectiveWatchedSeconds = Math.max(watchedSeconds, Number(lesson.video?.duration ?? watchedSeconds));
    const progress = await coursesRepository.markLessonCompleted(userId, lessonId, effectiveWatchedSeconds);

    const completedCount = new Set([...snapshot.completedLessonIds, lessonId]).size;
    const totalLessons = snapshot.lessons.length;
    await coursesRepository.updateEnrollmentProgress(
      userId,
      courseId,
      calculateProgressPercent(completedCount, totalLessons),
      totalLessons > 0 && completedCount >= totalLessons
    );

    return {
      lessonId,
      isCompleted: true,
      progressPercent: calculateProgressPercent(completedCount, totalLessons),
      updatedAt: progress.updatedAt,
    };
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

    if (video.provider === 'VIMEO') {
      await vimeoService.deleteVideo(video.resourceId);
    }

    return await coursesRepository.deleteVideo(id);
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

  async enrollCourse(courseId: number, userId: number) {
    const course = await coursesRepository.getPublishedCourseById(courseId);
    if (!course) {
      throw buildAppError('Course not found', 404);
    }

    const existingEnrollment = await coursesRepository.findEnrollment(userId, courseId);
    if (existingEnrollment) {
      return existingEnrollment;
    }

    const maxStudents = course.maxStudents ? Number(course.maxStudents) : null;
    if (maxStudents !== null) {
      const enrolledCount = await coursesRepository.countEnrollments(courseId);
      if (enrolledCount >= maxStudents) {
        throw buildAppError('Course is full', 409, 'COURSE_FULL');
      }
    }

    return await coursesRepository.createEnrollment(userId, courseId);
  },
};
