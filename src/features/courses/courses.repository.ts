import { db } from '../../db/index.js';
import {
  users,
  categories,
  subcategories,
  courses,
  lessons,
  lessonDocuments,
  lessonQuizzes,
  lessonQuizQuestions,
  userLessonQuizAttempts,
  userLessonQuizAnswers,
  courseRelatedCourses,
  videos,
  videoQuestions,
  exams,
  examQuestions,
  userExamAttempts,
  userExamAnswers,
  enrollments,
  certificates,
  userLessonProgress,
  userVideoAnswers,
  courseReviews,
  courseRefundRequests,
  orderItems,
  orders,
  cartItems,
} from '../../db/schema/index.js';
import { eq, and, desc, asc, count, inArray, sql, or, ilike, isNotNull, avg } from 'drizzle-orm';
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
  CreateVideoQuestionAnswerInput,
  UpdateVideoQuestionInput,
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
  CompleteVideoUploadInput,
} from './courses.schema.js';

const LEARNER_ACCESSIBLE_COURSE_STATUSES = ['PUBLISHED', 'ARCHIVED'] as const;
type DbConnection = any;
type CourseWriteTimestampValue = string | Date | null | undefined;
type VideoProviderValue = 'YOUTUBE' | 'VIMEO' | 'CLOUDFLARE' | 'S3';
type VideoStatusValue = 'PROCESSING' | 'READY' | 'FAILED';
type VideoListFilters = {
  search?: string;
  provider?: VideoProviderValue;
  status?: VideoStatusValue;
  used?: boolean;
  page?: number;
  limit?: number;
};
type VideoUsageSummary = {
  previewCourseCount: number;
  lessonUsageCount: number;
  totalUsageCount: number;
};
type CourseDeletionBlockers = {
  enrollmentsCount: number;
  certificatesCount: number;
  orderItemsCount: number;
};
type CourseAdminAction = 'delete' | 'archive';
type CourseDeletionMetadata = {
  deletionBlockers: CourseDeletionBlockers;
  canHardDelete: boolean;
  recommendedAdminAction: CourseAdminAction;
};
type CourseReviewStatsSummary = {
  reviewsCount: number;
  averageRating: number;
};
type EnrollmentStatus = 'ACTIVE' | 'CANCELLED' | 'REFUND_PENDING';
type EnrolledCourseStatusFilter = 'active' | 'cancelled' | 'all';
type RefundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type CreateCourseRepositoryInput = CreateCourseInput & {
  publishedAt?: CourseWriteTimestampValue;
};
type UpdateCourseRepositoryInput = UpdateCourseInput & {
  publishedAt?: CourseWriteTimestampValue;
};

function toTimestampValue(value: CourseWriteTimestampValue) {
  if (value === undefined || value === null) {
    return value;
  }

  return value instanceof Date ? value : new Date(value);
}

function createEmptyVideoUsage(): VideoUsageSummary {
  return {
    previewCourseCount: 0,
    lessonUsageCount: 0,
    totalUsageCount: 0,
  };
}

function buildCourseDeletionMetadata(blockers: CourseDeletionBlockers): CourseDeletionMetadata {
  const canHardDelete =
    blockers.enrollmentsCount === 0
    && blockers.certificatesCount === 0
    && blockers.orderItemsCount === 0;

  return {
    deletionBlockers: blockers,
    canHardDelete,
    recommendedAdminAction: canHardDelete ? 'delete' : 'archive',
  };
}

function attachVideoUsage<T extends { id: number }>(
  videoRows: T[],
  usageMap: Map<number, VideoUsageSummary>
): Array<T & { usage: VideoUsageSummary }> {
  return videoRows.map((video) => ({
    ...video,
    usage: usageMap.get(video.id) ?? createEmptyVideoUsage(),
  }));
}

export const coursesRepository = {
  async buildVideoUsageMap(videoIds: number[]) {
    if (videoIds.length === 0) {
      return new Map<number, VideoUsageSummary>();
    }

    const lessonUsageRows = await db
      .select({
        videoId: lessons.videoId,
        count: count(lessons.id),
      })
      .from(lessons)
      .where(inArray(lessons.videoId, videoIds))
      .groupBy(lessons.videoId);

    const previewUsageRows = await db
      .select({
        videoId: courses.previewVideoId,
        count: count(courses.id),
      })
      .from(courses)
      .where(and(isNotNull(courses.previewVideoId), inArray(courses.previewVideoId, videoIds)))
      .groupBy(courses.previewVideoId);

    const usageMap = new Map<number, VideoUsageSummary>();

    for (const videoId of videoIds) {
      usageMap.set(videoId, createEmptyVideoUsage());
    }

    for (const row of lessonUsageRows) {
      const videoId = Number(row.videoId);
      if (!Number.isFinite(videoId)) {
        continue;
      }

      const existing = usageMap.get(videoId) ?? createEmptyVideoUsage();
      const lessonUsageCount = Number(row.count ?? 0);
      usageMap.set(videoId, {
        ...existing,
        lessonUsageCount,
        totalUsageCount: existing.previewCourseCount + lessonUsageCount,
      });
    }

    for (const row of previewUsageRows) {
      const videoId = Number(row.videoId);
      if (!Number.isFinite(videoId)) {
        continue;
      }

      const existing = usageMap.get(videoId) ?? createEmptyVideoUsage();
      const previewCourseCount = Number(row.count ?? 0);
      usageMap.set(videoId, {
        ...existing,
        previewCourseCount,
        totalUsageCount: existing.lessonUsageCount + previewCourseCount,
      });
    }

    return usageMap;
  },

  async getNextVideoQuestionSortOrder(lessonId: number) {
    const [row] = await db
      .select({
        nextSortOrder: sql<number>`coalesce(max(${videoQuestions.sortOrder}), -1) + 1`,
      })
      .from(videoQuestions)
      .where(eq(videoQuestions.lessonId, lessonId));

    return Number(row?.nextSortOrder ?? 0);
  },

  async buildCategoryCountMaps(status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
    const categoryConditions = [isNotNull(courses.categoryId)];
    const subcategoryConditions = [isNotNull(courses.subcategoryId)];

    if (status) {
      categoryConditions.push(eq(courses.status, status));
      subcategoryConditions.push(eq(courses.status, status));
    }

    const categorySummary = await db
      .select({
        categoryId: courses.categoryId,
        count: count(courses.id),
      })
      .from(courses)
      .where(and(...categoryConditions))
      .groupBy(courses.categoryId);

    const subcategorySummary = await db
      .select({
        subcategoryId: courses.subcategoryId,
        count: count(courses.id),
      })
      .from(courses)
      .where(and(...subcategoryConditions))
      .groupBy(courses.subcategoryId);

    return {
      categoryCountMap: new Map(
        categorySummary
          .filter((row) => row.categoryId !== null)
          .map((row) => [Number(row.categoryId), row.count])
      ),
      subcategoryCountMap: new Map(
        subcategorySummary
          .filter((row) => row.subcategoryId !== null)
          .map((row) => [Number(row.subcategoryId), row.count])
      ),
    };
  },

  async attachCategoryCounts<T extends Array<any>>(
    categoryRows: T,
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  ): Promise<T> {
    if (categoryRows.length === 0) {
      return categoryRows;
    }

    const { categoryCountMap, subcategoryCountMap } = await this.buildCategoryCountMaps(status);

    return categoryRows.map((category) => ({
      ...category,
      courseCount: categoryCountMap.get(category.id) ?? 0,
      subcategories: Array.isArray(category.subcategories)
        ? category.subcategories.map((subcategory: any) => ({
            ...subcategory,
            courseCount: subcategoryCountMap.get(subcategory.id) ?? 0,
          }))
        : [],
    })) as T;
  },

  // Category operations
  async listCategories() {
    const categoryRows = await db.query.categories.findMany({
      with: {
        subcategories: true,
      },
    });

    return await this.attachCategoryCounts(categoryRows);
  },

  async listPublishedCategories() {
    const categoryRows = await db.query.categories.findMany({
      with: {
        subcategories: true,
      },
    });

    return await this.attachCategoryCounts(categoryRows, 'PUBLISHED');
  },

  async getCategoryById(id: number) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, id),
      with: {
        subcategories: true,
      },
    });

    if (!category) {
      return null;
    }

    const [categoryWithCounts] = await this.attachCategoryCounts([category]);
    return categoryWithCounts;
  },

  async countCoursesByCategory(id: number) {
    const [result] = await db
      .select({ count: count(courses.id) })
      .from(courses)
      .where(eq(courses.categoryId, id));
    return result?.count ?? 0;
  },

  async countCoursesBySubcategory(id: number) {
    const [result] = await db
      .select({ count: count(courses.id) })
      .from(courses)
      .where(eq(courses.subcategoryId, id));
    return result?.count ?? 0;
  },

  async createCategory(data: CreateCategoryInput) {
    const [result] = await db.insert(categories).values(data).returning();
    return result;
  },

  async updateCategory(id: number, data: UpdateCategoryInput) {
    const [result] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return result;
  },

  async deleteCategory(id: number) {
    const [result] = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result;
  },

  // Subcategory operations
  async listSubcategories(categoryId?: number) {
    return await db.query.subcategories.findMany({
      where: categoryId ? eq(subcategories.categoryId, categoryId) : undefined,
    });
  },

  async getSubcategoryById(id: number) {
    return await db.query.subcategories.findFirst({
      where: eq(subcategories.id, id),
    });
  },

  async createSubcategory(data: CreateSubcategoryInput) {
    const [result] = await db.insert(subcategories).values(data).returning();
    return result;
  },

  async updateSubcategory(id: number, data: UpdateSubcategoryInput) {
    const [result] = await db
      .update(subcategories)
      .set(data)
      .where(eq(subcategories.id, id))
      .returning();
    return result;
  },

  async deleteSubcategory(id: number) {
    const [result] = await db.delete(subcategories).where(eq(subcategories.id, id)).returning();
    return result;
  },

  // Course operations
  async listCourses(filters?: { categoryId?: number; search?: string; limit?: number }) {
    const conditions = [];

    if (filters?.categoryId) {
      conditions.push(eq(courses.categoryId, filters.categoryId));
    }

    const search = filters?.search?.trim();
    if (search) {
      conditions.push(
        or(
          ilike(courses.title, `%${search}%`),
          ilike(courses.description, `%${search}%`),
          ilike(courses.authorName, `%${search}%`)
        )!
      );
    }

    const courseRows = await db.query.courses.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        subcategory: true,
      },
      orderBy: [desc(courses.createdAt)],
      limit: filters?.limit,
    });

    return await this.attachCourseSummaries(courseRows, undefined, { includeDeletionMetadata: true });
  },

  async listPublishedCourses(filters?: { categoryId?: number; search?: string; limit?: number }) {
    const conditions = [eq(courses.status, 'PUBLISHED')];

    if (filters?.categoryId) {
      conditions.push(eq(courses.categoryId, filters.categoryId));
    }

    const search = filters?.search?.trim();
    if (search) {
      conditions.push(
        or(
          ilike(courses.title, `%${search}%`),
          ilike(courses.description, `%${search}%`),
          ilike(courses.authorName, `%${search}%`)
        )!
      );
    }

    const courseRows = await db.query.courses.findMany({
      where: and(...conditions),
      with: {
        category: true,
        subcategory: true,
      },
      orderBy: [desc(courses.createdAt)],
      limit: filters?.limit,
    });

    return await this.attachCourseSummaries(courseRows);
  },

  async getCourseById(id: number) {
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, id),
      with: {
        category: true,
        subcategory: true,
        previewVideo: true,
        lessons: {
          orderBy: [asc(lessons.sequenceOrder)],
          with: {
            video: true,
            videoQuestions: {
              orderBy: [asc(videoQuestions.displayAtSeconds), asc(videoQuestions.sortOrder), asc(videoQuestions.id)],
            },
            documents: true,
            lessonQuizzes: {
              with: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    return await this.attachCourseDetails(course, undefined, { includeDeletionMetadata: true });
  },

  async getPublishedCourseById(id: number) {
    const course = await db.query.courses.findFirst({
      where: and(eq(courses.id, id), eq(courses.status, 'PUBLISHED')),
      with: {
        category: true,
        subcategory: true,
        previewVideo: true,
        lessons: {
          orderBy: [asc(lessons.sequenceOrder)],
          with: {
            video: true,
            videoQuestions: {
              orderBy: [asc(videoQuestions.displayAtSeconds), asc(videoQuestions.sortOrder), asc(videoQuestions.id)],
            },
            documents: true,
            lessonQuizzes: {
              with: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    return await this.attachCourseDetails(course);
  },

  async getCourseForLearner(id: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const course = await conn.query.courses.findFirst({
      where: and(eq(courses.id, id), inArray(courses.status, [...LEARNER_ACCESSIBLE_COURSE_STATUSES])),
      with: {
        category: true,
        subcategory: true,
        previewVideo: true,
        lessons: {
          orderBy: [asc(lessons.sequenceOrder)],
          with: {
            video: true,
            videoQuestions: {
              orderBy: [asc(videoQuestions.displayAtSeconds), asc(videoQuestions.sortOrder), asc(videoQuestions.id)],
            },
            documents: true,
            lessonQuizzes: {
              with: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    return await this.attachCourseDetails(course, tx);
  },

  async createCourse(data: CreateCourseRepositoryInput) {
    const [result] = await db.insert(courses).values({
      ...data,
      price: data.price ? data.price.toString() : null,
      cpeCredits: data.cpeCredits != null ? data.cpeCredits.toString() : '0',
      enrollmentDeadline: toTimestampValue(data.enrollmentDeadline) ?? null,
      courseEndAt: toTimestampValue(data.courseEndAt) ?? null,
      publishedAt: toTimestampValue(data.publishedAt) ?? null,
    }).returning();
    return result;
  },

  async updateCourse(id: number, data: UpdateCourseRepositoryInput) {
    const [result] = await db
      .update(courses)
      .set({
        ...data,
        price: data.price ? data.price.toString() : undefined,
        cpeCredits: data.cpeCredits != null ? data.cpeCredits.toString() : undefined,
        enrollmentDeadline: toTimestampValue(data.enrollmentDeadline),
        courseEndAt: toTimestampValue(data.courseEndAt),
        publishedAt: toTimestampValue(data.publishedAt),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning();
    return result;
  },

  async getCourseDeletionBlockers(id: number): Promise<CourseDeletionBlockers> {
    const [enrollmentSummary, certificateSummary, orderItemSummary] = await Promise.all([
      db
        .select({ count: count(enrollments.id) })
        .from(enrollments)
        .where(eq(enrollments.courseId, id)),
      db
        .select({ count: count(certificates.id) })
        .from(certificates)
        .where(eq(certificates.courseId, id)),
      db
        .select({ count: count(orderItems.id) })
        .from(orderItems)
        .where(eq(orderItems.courseId, id)),
    ]);

    return {
      enrollmentsCount: Number(enrollmentSummary[0]?.count ?? 0),
      certificatesCount: Number(certificateSummary[0]?.count ?? 0),
      orderItemsCount: Number(orderItemSummary[0]?.count ?? 0),
    };
  },

  async deleteCourse(id: number) {
    return await db.transaction(async (tx) => {
      const [courseRow] = await tx
        .select({
          previewVideoId: courses.previewVideoId,
        })
        .from(courses)
        .where(eq(courses.id, id));

      if (!courseRow) {
        return null;
      }

      const lessonRows = await tx
        .select({ id: lessons.id, videoId: lessons.videoId })
        .from(lessons)
        .where(eq(lessons.courseId, id));
      const lessonIds = lessonRows.map((row) => row.id);
      const candidateVideoIds = Array.from(
        new Set(
          [
            courseRow.previewVideoId,
            ...lessonRows.map((row) => row.videoId),
          ].filter((videoId): videoId is number => Number.isInteger(videoId))
        )
      );

      if (lessonIds.length > 0) {
        const videoQuestionRows = await tx
          .select({ id: videoQuestions.id })
          .from(videoQuestions)
          .where(inArray(videoQuestions.lessonId, lessonIds));
        const videoQuestionIds = videoQuestionRows.map((row) => row.id);

        if (videoQuestionIds.length > 0) {
          await tx.delete(userVideoAnswers).where(inArray(userVideoAnswers.videoQuestionId, videoQuestionIds));
          await tx.delete(videoQuestions).where(inArray(videoQuestions.id, videoQuestionIds));
        }

        await tx.delete(userLessonProgress).where(inArray(userLessonProgress.lessonId, lessonIds));
        await tx.delete(lessons).where(inArray(lessons.id, lessonIds));
      }

      const examRows = await tx
        .select({ id: exams.id })
        .from(exams)
        .where(eq(exams.courseId, id));
      const examIds = examRows.map((row) => row.id);

      if (examIds.length > 0) {
        const [examQuestionRows, examAttemptRows] = await Promise.all([
          tx
            .select({ id: examQuestions.id })
            .from(examQuestions)
            .where(inArray(examQuestions.examId, examIds)),
          tx
            .select({ id: userExamAttempts.id })
            .from(userExamAttempts)
            .where(inArray(userExamAttempts.examId, examIds)),
        ]);

        const examQuestionIds = examQuestionRows.map((row) => row.id);
        const examAttemptIds = examAttemptRows.map((row) => row.id);

        if (examAttemptIds.length > 0) {
          await tx.delete(userExamAnswers).where(inArray(userExamAnswers.attemptId, examAttemptIds));
          await tx.delete(userExamAttempts).where(inArray(userExamAttempts.id, examAttemptIds));
        }

        if (examQuestionIds.length > 0) {
          await tx.delete(userExamAnswers).where(inArray(userExamAnswers.examQuestionId, examQuestionIds));
          await tx.delete(examQuestions).where(inArray(examQuestions.id, examQuestionIds));
        }

        await tx.delete(exams).where(inArray(exams.id, examIds));
      }

      await tx.delete(cartItems).where(eq(cartItems.courseId, id));

      const [deletedCourse] = await tx.delete(courses).where(eq(courses.id, id)).returning();

      let deletedVideos: typeof videos.$inferSelect[] = [];

      if (candidateVideoIds.length > 0) {
        const orphanVideos = await tx
          .select()
          .from(videos)
          .where(and(
            inArray(videos.id, candidateVideoIds),
            sql`not exists (
              select 1
              from ${lessons}
              where ${lessons.videoId} = ${videos.id}
            )`,
            sql`not exists (
              select 1
              from ${courses}
              where ${courses.previewVideoId} = ${videos.id}
            )`
          ));

        const orphanVideoIds = orphanVideos.map((video) => video.id);
        if (orphanVideoIds.length > 0) {
          await tx.delete(videos).where(inArray(videos.id, orphanVideoIds));
          deletedVideos = orphanVideos;
        }
      }

      return {
        course: deletedCourse,
        deletedVideos,
      };
    });
  },

  async replaceRelatedCourses(courseId: number, relatedCourseIds: number[]) {
    await db.delete(courseRelatedCourses).where(eq(courseRelatedCourses.courseId, courseId));

    if (relatedCourseIds.length === 0) {
      return [];
    }

    const payload = relatedCourseIds
      .filter((relatedCourseId) => relatedCourseId !== courseId)
      .map((relatedCourseId, index) => ({
        courseId,
        relatedCourseId,
        sortOrder: index,
      }));

    if (payload.length === 0) {
      return [];
    }

    return await db.insert(courseRelatedCourses).values(payload).returning();
  },

  async listLessonsByCourse(courseId: number) {
    return await db.query.lessons.findMany({
      where: eq(lessons.courseId, courseId),
      orderBy: [asc(lessons.sequenceOrder)],
      with: {
        video: true,
        videoQuestions: {
          orderBy: [asc(videoQuestions.displayAtSeconds), asc(videoQuestions.sortOrder), asc(videoQuestions.id)],
        },
        documents: true,
        lessonQuizzes: {
          with: {
            questions: true,
          },
        },
      },
    });
  },

  async getLessonById(id: number) {
    return await db.query.lessons.findFirst({
      where: eq(lessons.id, id),
      with: {
        video: true,
        videoQuestions: {
          orderBy: [asc(videoQuestions.displayAtSeconds), asc(videoQuestions.sortOrder), asc(videoQuestions.id)],
        },
        documents: true,
        lessonQuizzes: {
          with: {
            questions: true,
          },
        },
      },
    });
  },

  async getVideoQuestionById(id: number) {
    return await db.query.videoQuestions.findFirst({
      where: eq(videoQuestions.id, id),
      with: {
        lesson: {
          with: {
            course: true,
            video: true,
          },
        },
      },
    });
  },

  async createLesson(courseId: number, data: CreateLessonInput) {
    const [lesson] = await db.insert(lessons).values({
      courseId,
      title: data.title,
      videoId: data.videoId,
      sequenceOrder: data.sequenceOrder,
    }).returning();

    return lesson;
  },

  async updateLesson(id: number, data: UpdateLessonInput) {
    const [lesson] = await db.update(lessons).set(data).where(eq(lessons.id, id)).returning();
    return lesson;
  },

  async deleteLesson(id: number) {
    const [lesson] = await db.delete(lessons).where(eq(lessons.id, id)).returning();
    return lesson;
  },

  async createLessonDocument(lessonId: number, data: CreateLessonDocumentInput) {
    const [document] = await db.insert(lessonDocuments).values({
      lessonId,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      fileUrl: data.fileUrl,
    }).returning();

    return document;
  },

  async deleteLessonDocument(id: number) {
    const [document] = await db.delete(lessonDocuments).where(eq(lessonDocuments.id, id)).returning();
    return document;
  },

  async createVideoQuestion(lessonId: number, data: CreateVideoQuestionInput) {
    const sortOrder = data.sortOrder ?? await this.getNextVideoQuestionSortOrder(lessonId);
    const [question] = await db.insert(videoQuestions).values({
      lessonId,
      questionText: data.questionText,
      displayAtSeconds: data.displayAtSeconds,
      sortOrder,
      questionType: data.questionType,
      options: data.options ?? null,
      correctAnswer: data.correctAnswer ?? null,
      updatedAt: new Date(),
    }).returning();

    return question;
  },

  async createVideoQuestionsBulk(lessonId: number, data: CreateVideoQuestionInput[]) {
    if (data.length === 0) {
      return [];
    }

    return await db.transaction(async (tx) => {
      await tx.execute(sql`
        select ${lessons.id}
        from ${lessons}
        where ${lessons.id} = ${lessonId}
        for update
      `);

      const [sortOrderRow] = await tx
        .select({
          maxSortOrder: sql<number>`coalesce(max(${videoQuestions.sortOrder}), -1)`,
        })
        .from(videoQuestions)
        .where(eq(videoQuestions.lessonId, lessonId));

      let nextSortOrder = Number(sortOrderRow?.maxSortOrder ?? -1) + 1;

      return await tx.insert(videoQuestions).values(
        data.map((question) => ({
          lessonId,
          questionText: question.questionText,
          displayAtSeconds: question.displayAtSeconds,
          sortOrder: question.sortOrder ?? nextSortOrder++,
          questionType: question.questionType,
          options: question.options ?? null,
          correctAnswer: question.correctAnswer ?? null,
          updatedAt: new Date(),
        }))
      ).returning();
    });
  },

  async deleteVideoQuestion(id: number) {
    const [question] = await db.delete(videoQuestions).where(eq(videoQuestions.id, id)).returning();
    return question;
  },

  async updateVideoQuestion(id: number, data: UpdateVideoQuestionInput) {
    const [question] = await db.update(videoQuestions).set({
      ...(data.questionText !== undefined ? { questionText: data.questionText } : {}),
      ...(data.displayAtSeconds !== undefined ? { displayAtSeconds: data.displayAtSeconds } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.questionType !== undefined ? { questionType: data.questionType } : {}),
      ...(data.options !== undefined ? { options: data.options } : {}),
      ...(data.correctAnswer !== undefined ? { correctAnswer: data.correctAnswer } : {}),
      updatedAt: new Date(),
    }).where(eq(videoQuestions.id, id)).returning();

    return question;
  },

  async getLessonQuizByLessonId(lessonId: number) {
    return await db.query.lessonQuizzes.findFirst({
      where: eq(lessonQuizzes.lessonId, lessonId),
      with: {
        questions: true,
      },
    });
  },

  async createLessonQuiz(lessonId: number, data: CreateLessonQuizInput) {
    const [quiz] = await db.insert(lessonQuizzes).values({
      lessonId,
      passingScorePercent: data.passingScorePercent ?? 70,
      maxAttempts: data.maxAttempts ?? null,
    }).returning();

    return quiz;
  },

  async updateLessonQuiz(id: number, data: UpdateLessonQuizInput) {
    const [quiz] = await db.update(lessonQuizzes).set({
      passingScorePercent: data.passingScorePercent,
      maxAttempts: data.maxAttempts,
      updatedAt: new Date(),
    }).where(eq(lessonQuizzes.id, id)).returning();

    return quiz;
  },

  async replaceLessonQuizQuestions(lessonQuizId: number, questionsPayload: CreateLessonQuizQuestionInput[]) {
    await db.delete(lessonQuizQuestions).where(eq(lessonQuizQuestions.lessonQuizId, lessonQuizId));

    if (questionsPayload.length === 0) {
      return [];
    }

    return await db.insert(lessonQuizQuestions).values(
      questionsPayload.map((question) => ({
        lessonQuizId,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options ?? null,
        correctAnswer: question.correctAnswer ?? null,
        scoreWeight: question.scoreWeight ?? 1,
      }))
    ).returning();
  },

  async createLessonQuizQuestion(lessonQuizId: number, data: CreateLessonQuizQuestionInput) {
    const [question] = await db.insert(lessonQuizQuestions).values({
      lessonQuizId,
      questionText: data.questionText,
      questionType: data.questionType,
      options: data.options ?? null,
      correctAnswer: data.correctAnswer ?? null,
      scoreWeight: data.scoreWeight ?? 1,
    }).returning();

    return question;
  },

  async updateLessonQuizQuestion(id: number, data: UpdateLessonQuizQuestionInput) {
    const [question] = await db.update(lessonQuizQuestions).set({
      questionText: data.questionText,
      questionType: data.questionType,
      options: data.options ?? undefined,
      correctAnswer: data.correctAnswer,
      scoreWeight: data.scoreWeight,
    }).where(eq(lessonQuizQuestions.id, id)).returning();

    return question;
  },

  async deleteLessonQuizQuestion(id: number) {
    const [question] = await db.delete(lessonQuizQuestions).where(eq(lessonQuizQuestions.id, id)).returning();
    return question;
  },

  async getExamByCourseId(courseId: number) {
    return await db.query.exams.findFirst({
      where: eq(exams.courseId, courseId),
      with: {
        questions: true,
      },
    });
  },

  async createExam(courseId: number, data: CreateExamInput) {
    const [exam] = await db.insert(exams).values({
      courseId,
      title: data.title,
      description: data.description ?? null,
      passingScorePercent: data.passingScorePercent ?? 70,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
    }).returning();

    return exam;
  },

  async updateExam(id: number, data: UpdateExamInput) {
    const [exam] = await db.update(exams).set(data).where(eq(exams.id, id)).returning();
    return exam;
  },

  async deleteExam(id: number) {
    const [exam] = await db.delete(exams).where(eq(exams.id, id)).returning();
    return exam;
  },

  async createExamQuestion(examId: number, data: CreateExamQuestionInput) {
    const [question] = await db.insert(examQuestions).values({
      examId,
      questionText: data.questionText,
      questionType: data.questionType,
      options: data.options ?? null,
      scoreWeight: data.scoreWeight ?? 1,
      correctAnswer: data.correctAnswer ?? null,
    }).returning();

    return question;
  },

  async updateExamQuestion(id: number, data: UpdateExamQuestionInput) {
    const [question] = await db.update(examQuestions).set({
      questionText: data.questionText,
      questionType: data.questionType,
      options: data.options ?? undefined,
      scoreWeight: data.scoreWeight,
      correctAnswer: data.correctAnswer,
    }).where(eq(examQuestions.id, id)).returning();

    return question;
  },

  async deleteExamQuestion(id: number) {
    const [question] = await db.delete(examQuestions).where(eq(examQuestions.id, id)).returning();
    return question;
  },

  async createVideo(data: CompleteVideoUploadInput & { status?: 'PROCESSING' | 'READY' | 'FAILED'; playbackUrl?: string | null }) {
    const existing = await this.getVideoByResourceId(data.provider, data.resourceId);
    if (existing) {
      const [updated] = await db.update(videos).set({
        name: data.name || existing.name,
        duration: data.duration ?? existing.duration,
        status: data.status ?? existing.status,
        playbackUrl: data.playbackUrl ?? existing.playbackUrl,
        updatedAt: new Date(),
      }).where(eq(videos.id, existing.id)).returning();
      return updated;
    }

    const [video] = await db.insert(videos).values({
      name: data.name,
      provider: data.provider,
      resourceId: data.resourceId,
      duration: data.duration,
      playbackUrl: data.playbackUrl ?? null,
      status: data.status ?? 'PROCESSING',
    }).returning();

    return video;
  },

  async updateVideoStatus(id: number, status: 'PROCESSING' | 'READY' | 'FAILED', extra?: { duration?: number; name?: string; playbackUrl?: string | null }) {
    const [updated] = await db.update(videos).set({
      status,
      ...(extra?.duration !== undefined ? { duration: extra.duration } : {}),
      ...(extra?.name ? { name: extra.name } : {}),
      ...(extra?.playbackUrl !== undefined ? { playbackUrl: extra.playbackUrl } : {}),
      updatedAt: new Date(),
    }).where(eq(videos.id, id)).returning();
    return updated ?? null;
  },

  async getVideoByResourceId(provider: string, resourceId: string) {
    return await db.query.videos.findFirst({
      where: and(eq(videos.provider, provider as any), eq(videos.resourceId, resourceId)),
    });
  },

  async getVideoById(id: number) {
    return await db.query.videos.findFirst({
      where: eq(videos.id, id),
    });
  },

  async getVideoWithUsage(id: number) {
    const video = await this.getVideoById(id);
    if (!video) {
      return null;
    }

    const usageMap = await this.buildVideoUsageMap([id]);
    return attachVideoUsage([video], usageMap)[0] ?? null;
  },

  async listVideos(filters?: VideoListFilters) {
    const allVideos = await db.query.videos.findMany({
      orderBy: [desc(videos.createdAt), desc(videos.id)],
    });

    const usageMap = await this.buildVideoUsageMap(allVideos.map((video) => video.id));
    const search = filters?.search?.trim().toLowerCase();

    const filteredVideos = attachVideoUsage(allVideos, usageMap).filter((video) => {
      if (filters?.provider && video.provider !== filters.provider) {
        return false;
      }

      if (filters?.status && video.status !== filters.status) {
        return false;
      }

      if (typeof filters?.used === 'boolean') {
        const isUsed = video.usage.totalUsageCount > 0;
        if (filters.used !== isUsed) {
          return false;
        }
      }

      if (search) {
        const haystacks = [video.name ?? '', video.resourceId ?? ''];
        return haystacks.some((value) => value.toLowerCase().includes(search));
      }

      return true;
    });

    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.max(1, filters?.limit ?? 20);
    const total = filteredVideos.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginatedVideos = filteredVideos.slice(startIndex, startIndex + limit);

    const stats = filteredVideos.reduce<{
      total: number;
      totalDurationSeconds: number;
      totalDurationHours: number;
      byProvider: Record<string, number>;
      byStatus: Record<string, number>;
    }>((accumulator, video) => {
      const providerKey = String(video.provider || 'UNKNOWN');
      const statusKey = String(video.status || 'PROCESSING');
      const durationSeconds = Number(video.duration ?? 0);

      accumulator.total += 1;
      accumulator.totalDurationSeconds += durationSeconds;
      accumulator.byProvider[providerKey] = (accumulator.byProvider[providerKey] ?? 0) + 1;
      accumulator.byStatus[statusKey] = (accumulator.byStatus[statusKey] ?? 0) + 1;
      return accumulator;
    }, {
      total: 0,
      totalDurationSeconds: 0,
      totalDurationHours: 0,
      byProvider: {},
      byStatus: {},
    });

    stats.totalDurationHours = Number((stats.totalDurationSeconds / 3600).toFixed(2));

    return {
      videos: paginatedVideos,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async listUserLessonProgress(userId: number, lessonIds: number[], tx?: DbConnection) {
    if (lessonIds.length === 0) {
      return [];
    }

    const conn = tx ?? db;
    return await conn.query.userLessonProgress.findMany({
      where: and(eq(userLessonProgress.userId, userId), inArray(userLessonProgress.lessonId, lessonIds)),
    });
  },

  async listUserVideoAnswers(userId: number, videoQuestionIds: number[], tx?: DbConnection) {
    if (videoQuestionIds.length === 0) {
      return [];
    }

    const conn = tx ?? db;
    return await conn.query.userVideoAnswers.findMany({
      where: and(eq(userVideoAnswers.userId, userId), inArray(userVideoAnswers.videoQuestionId, videoQuestionIds)),
    });
  },

  async listUserLessonQuizAttempts(userId: number, lessonQuizIds: number[], tx?: DbConnection) {
    if (lessonQuizIds.length === 0) {
      return [];
    }

    const conn = tx ?? db;
    return await conn.query.userLessonQuizAttempts.findMany({
      where: and(eq(userLessonQuizAttempts.userId, userId), inArray(userLessonQuizAttempts.lessonQuizId, lessonQuizIds)),
      orderBy: [desc(userLessonQuizAttempts.finishedAt), desc(userLessonQuizAttempts.id)],
    });
  },

  async upsertLessonProgress(userId: number, lessonId: number, data: UpdateLessonProgressInput & { isCompleted: boolean }, tx?: DbConnection) {
    const conn = tx ?? db;
    const [progress] = await conn
      .insert(userLessonProgress)
      .values({
        userId,
        lessonId,
        lastWatchedSeconds: data.lastWatchedSeconds,
        isCompleted: data.isCompleted ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userLessonProgress.userId, userLessonProgress.lessonId],
        set: {
          lastWatchedSeconds: data.lastWatchedSeconds,
          isCompleted: data.isCompleted,
          updatedAt: new Date(),
        },
      })
      .returning();

    return progress;
  },

  async markLessonCompleted(userId: number, lessonId: number, lastWatchedSeconds: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [progress] = await conn
      .insert(userLessonProgress)
      .values({
        userId,
        lessonId,
        lastWatchedSeconds,
        isCompleted: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userLessonProgress.userId, userLessonProgress.lessonId],
        set: {
          lastWatchedSeconds,
          isCompleted: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return progress;
  },

  async createLessonQuizAttempt(
    userId: number,
    lessonQuizId: number,
    data: {
      scoreObtained: number;
      totalScore: number;
      scorePercent: number;
      isPassed: boolean;
      startedAt?: Date;
      finishedAt?: Date;
    },
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const [attempt] = await conn.insert(userLessonQuizAttempts).values({
      userId,
      lessonQuizId,
      scoreObtained: data.scoreObtained.toFixed(2),
      totalScore: data.totalScore.toFixed(2),
      scorePercent: data.scorePercent.toFixed(2),
      isPassed: data.isPassed,
      startedAt: data.startedAt ?? new Date(),
      finishedAt: data.finishedAt ?? new Date(),
    }).returning();

    return attempt;
  },

  async createLessonQuizAnswers(
    attemptId: number,
    answers: Array<{
      lessonQuizQuestionId: number;
      answerGiven: string;
      isCorrect: boolean;
      pointsEarned: number;
    }>,
    tx?: DbConnection,
  ) {
    if (answers.length === 0) {
      return [];
    }

    const conn = tx ?? db;
    return await conn.insert(userLessonQuizAnswers).values(
      answers.map((answer) => ({
        attemptId,
        lessonQuizQuestionId: answer.lessonQuizQuestionId,
        answerGiven: answer.answerGiven,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned.toFixed(2),
      })),
    ).returning();
  },

  async upsertVideoQuestionAnswer(userId: number, videoQuestionId: number, data: CreateVideoQuestionAnswerInput, tx?: DbConnection) {
    const conn = tx ?? db;
    const [answer] = await conn
      .insert(userVideoAnswers)
      .values({
        userId,
        videoQuestionId,
        answerGiven: data.answerGiven,
        isCorrect: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userVideoAnswers.userId, userVideoAnswers.videoQuestionId],
        set: {
          answerGiven: data.answerGiven,
          isCorrect: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return answer;
  },

  async countVideoUsage(id: number) {
    const usageMap = await this.buildVideoUsageMap([id]);
    return usageMap.get(id)?.totalUsageCount ?? 0;
  },

  async deleteVideo(id: number) {
    const [video] = await db.delete(videos).where(eq(videos.id, id)).returning();
    return video;
  },

  async findEnrollment(userId: number, courseId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    return await conn.query.enrollments.findFirst({
      where: and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)),
    });
  },

  async findEnrollmentByStatus(
    userId: number,
    courseId: number,
    statuses?: EnrollmentStatus[],
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const conditions = [
      eq(enrollments.userId, userId),
      eq(enrollments.courseId, courseId),
    ];

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(enrollments.status, statuses));
    }

    return await conn.query.enrollments.findFirst({
      where: and(...conditions),
    });
  },

  async findCertificate(userId: number, courseId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    return await conn.query.certificates.findFirst({
      where: and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)),
    });
  },

  async attachEnrollmentSourceOrderItem(enrollmentId: number, sourceOrderItemId: number | null, tx?: DbConnection) {
    const conn = tx ?? db;
    const [enrollment] = await conn
      .update(enrollments)
      .set({
        sourceOrderItemId,
      })
      .where(eq(enrollments.id, enrollmentId))
      .returning();

    return enrollment;
  },

  async lockEnrollment(userId: number, courseId: number, tx: DbConnection) {
    await tx.execute(sql`
      select ${enrollments.id}
      from ${enrollments}
      where ${enrollments.userId} = ${userId}
        and ${enrollments.courseId} = ${courseId}
      for update
    `);
  },

  async updateEnrollmentStatus(
    userId: number,
    courseId: number,
    status: EnrollmentStatus,
    options?: {
      cancelledAt?: Date | null;
      cancelReason?: string | null;
      sourceOrderItemId?: number | null;
      lastAccessedAt?: Date | null;
    },
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const [enrollment] = await conn
      .update(enrollments)
      .set({
        status,
        cancelledAt: options?.cancelledAt,
        cancelReason: options?.cancelReason ?? null,
        ...(options?.sourceOrderItemId !== undefined ? { sourceOrderItemId: options.sourceOrderItemId } : {}),
        ...(options?.lastAccessedAt !== undefined ? { lastAccessedAt: options.lastAccessedAt } : {}),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .returning();

    return enrollment;
  },

  async reactivateEnrollment(userId: number, courseId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [enrollment] = await conn
      .update(enrollments)
      .set({
        status: 'ACTIVE',
        cancelledAt: null,
        cancelReason: null,
        lastAccessedAt: new Date(),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .returning();

    return enrollment;
  },

  async findLatestPaidOrderItemForUserCourse(userId: number, courseId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [row] = await conn
      .select({
        orderItemId: orderItems.id,
        orderId: orderItems.orderId,
        priceAtPurchase: orderItems.priceAtPurchase,
        orderStatus: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(
        eq(orderItems.courseId, courseId),
        eq(orders.userId, userId),
        inArray(orders.status, ['PAID', 'REFUNDED']),
      ))
      .orderBy(desc(orders.createdAt), desc(orderItems.id))
      .limit(1);

    return row ?? null;
  },

  async getOrderItemById(id: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [row] = await conn
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        courseId: orderItems.courseId,
        priceAtPurchase: orderItems.priceAtPurchase,
      })
      .from(orderItems)
      .where(eq(orderItems.id, id))
      .limit(1);

    return row ?? null;
  },

  async upsertCourseRefundRequest(
    data: {
      userId: number;
      courseId: number;
      enrollmentId: number;
      orderItemId?: number | null;
      status?: RefundRequestStatus;
      reason?: string | null;
      adminNote?: string | null;
      requestedAt?: Date;
      resolvedAt?: Date | null;
      resolvedByAdminId?: string | null;
    },
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const [refundRequest] = await conn
      .insert(courseRefundRequests)
      .values({
        userId: data.userId,
        courseId: data.courseId,
        enrollmentId: data.enrollmentId,
        orderItemId: data.orderItemId ?? null,
        status: data.status ?? 'PENDING',
        reason: data.reason ?? null,
        adminNote: data.adminNote ?? null,
        requestedAt: data.requestedAt ?? new Date(),
        resolvedAt: data.resolvedAt ?? null,
        resolvedByAdminId: data.resolvedByAdminId ?? null,
      })
      .onConflictDoUpdate({
        target: [courseRefundRequests.enrollmentId],
        set: {
          orderItemId: data.orderItemId ?? null,
          status: data.status ?? 'PENDING',
          reason: data.reason ?? null,
          adminNote: data.adminNote ?? null,
          requestedAt: data.requestedAt ?? new Date(),
          resolvedAt: data.resolvedAt ?? null,
          resolvedByAdminId: data.resolvedByAdminId ?? null,
        },
      })
      .returning();

    return refundRequest;
  },

  async getRefundRequestByEnrollmentId(enrollmentId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    return await conn.query.courseRefundRequests.findFirst({
      where: eq(courseRefundRequests.enrollmentId, enrollmentId),
    });
  },

  async getRefundRequestById(id: number, tx?: DbConnection) {
    const conn = tx ?? db;
    return await conn.query.courseRefundRequests.findFirst({
      where: eq(courseRefundRequests.id, id),
    });
  },

  async resolveRefundRequest(
    id: number,
    status: RefundRequestStatus,
    options?: {
      adminNote?: string | null;
      resolvedAt?: Date | null;
      resolvedByAdminId?: string | null;
    },
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const [refundRequest] = await conn
      .update(courseRefundRequests)
      .set({
        status,
        adminNote: options?.adminNote ?? null,
        resolvedAt: options?.resolvedAt ?? new Date(),
        resolvedByAdminId: options?.resolvedByAdminId ?? null,
      })
      .where(eq(courseRefundRequests.id, id))
      .returning();

    return refundRequest;
  },

  async listRefundRequests() {
    return await db
      .select({
        id: courseRefundRequests.id,
        status: courseRefundRequests.status,
        reason: courseRefundRequests.reason,
        adminNote: courseRefundRequests.adminNote,
        requestedAt: courseRefundRequests.requestedAt,
        resolvedAt: courseRefundRequests.resolvedAt,
        resolvedByAdminId: courseRefundRequests.resolvedByAdminId,
        enrollmentId: courseRefundRequests.enrollmentId,
        courseId: courseRefundRequests.courseId,
        orderItemId: courseRefundRequests.orderItemId,
        userId: courseRefundRequests.userId,
        userName: users.fullName,
        userEmail: users.email,
        courseTitle: courses.title,
        coursePrice: courses.price,
        orderId: orderItems.orderId,
      })
      .from(courseRefundRequests)
      .innerJoin(users, eq(courseRefundRequests.userId, users.id))
      .innerJoin(courses, eq(courseRefundRequests.courseId, courses.id))
      .leftJoin(orderItems, eq(courseRefundRequests.orderItemId, orderItems.id))
      .orderBy(desc(courseRefundRequests.requestedAt), desc(courseRefundRequests.id));
  },

  async countOrderItemsForOrder(orderId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [result] = await conn
      .select({ count: count(orderItems.id) })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    return Number(result?.count ?? 0);
  },

  async countApprovedRefundRequestsForOrder(orderId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [result] = await conn
      .select({ count: count(courseRefundRequests.id) })
      .from(courseRefundRequests)
      .innerJoin(orderItems, eq(courseRefundRequests.orderItemId, orderItems.id))
      .where(and(
        eq(orderItems.orderId, orderId),
        eq(courseRefundRequests.status, 'APPROVED'),
      ));

    return Number(result?.count ?? 0);
  },

  async updateOrderStatus(orderId: number, status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED', tx?: DbConnection) {
    const conn = tx ?? db;
    const [order] = await conn
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();

    return order;
  },

  async touchEnrollment(userId: number, courseId: number, lessonId?: number | null, tx?: DbConnection) {
    const conn = tx ?? db;
    const [enrollment] = await conn
      .update(enrollments)
      .set({
        lastAccessedAt: new Date(),
        ...(lessonId !== undefined ? { lastAccessedLessonId: lessonId } : {}),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .returning();

    return enrollment;
  },

  async updateEnrollmentProgress(
    userId: number,
    courseId: number,
    progressPercent: number,
    isCompleted: boolean,
    options?: {
      watchPercent?: number;
      lastAccessedLessonId?: number | null;
    },
    tx?: DbConnection,
  ) {
    const conn = tx ?? db;
    const [enrollment] = await conn
      .update(enrollments)
      .set({
        progressPercent: progressPercent.toFixed(2),
        ...(options?.watchPercent !== undefined ? { watchPercent: options.watchPercent.toFixed(2) } : {}),
        isCompleted,
        lastAccessedAt: new Date(),
        ...(options?.lastAccessedLessonId !== undefined ? { lastAccessedLessonId: options.lastAccessedLessonId } : {}),
      })
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .returning();

    return enrollment;
  },

  async createEnrollment(userId: number, courseId: number, sourceOrderItemId?: number | null) {
    const [enrollment] = await db.insert(enrollments).values({
      userId,
      courseId,
      sourceOrderItemId: sourceOrderItemId ?? null,
    }).returning();

    return enrollment;
  },

  async listEnrolledCourses(userId: number, statusFilter: EnrolledCourseStatusFilter = 'active') {
    const statusMap: Record<EnrolledCourseStatusFilter, EnrollmentStatus[] | undefined> = {
      active: ['ACTIVE'],
      cancelled: ['CANCELLED', 'REFUND_PENDING'],
      all: undefined,
    };
    const statuses = statusMap[statusFilter];
    const enrollmentConditions = [eq(enrollments.userId, userId)];
    if (statuses && statuses.length > 0) {
      enrollmentConditions.push(inArray(enrollments.status, statuses));
    }

    const enrollmentRows = await db.query.enrollments.findMany({
      where: and(...enrollmentConditions),
      with: {
        course: {
          with: {
            category: true,
            subcategory: true,
          },
        },
      },
      orderBy: [desc(enrollments.enrolledAt)],
    });

    const courseIds = enrollmentRows
      .map((row) => row.courseId)
      .filter((courseId): courseId is number => typeof courseId === 'number');
    const enrollmentIds = enrollmentRows.map((row) => row.id);

    if (courseIds.length === 0) {
      return [];
    }

    const lessonSummary = await db
      .select({
        courseId: lessons.courseId,
        count: count(lessons.id),
      })
      .from(lessons)
      .where(inArray(lessons.courseId, courseIds))
      .groupBy(lessons.courseId);

    const certificateRows = await db.query.certificates.findMany({
      where: and(eq(certificates.userId, userId), inArray(certificates.courseId, courseIds)),
    });
    const refundRequestRows = enrollmentIds.length > 0
      ? await db.query.courseRefundRequests.findMany({
          where: inArray(courseRefundRequests.enrollmentId, enrollmentIds),
          orderBy: [desc(courseRefundRequests.requestedAt), desc(courseRefundRequests.id)],
        })
      : [];

    const lessonCountMap = new Map(lessonSummary.map((row) => [row.courseId, row.count]));
    const certificateMap = new Map(certificateRows.map((row) => [row.courseId, row]));
    const refundRequestMap = new Map(refundRequestRows.map((row) => [row.enrollmentId, row]));

    return enrollmentRows
      .filter((row) => Boolean(row.course) && LEARNER_ACCESSIBLE_COURSE_STATUSES.includes(row.course.status as typeof LEARNER_ACCESSIBLE_COURSE_STATUSES[number]))
      .map((row) => ({
        ...row,
        course: row.course
          ? {
              ...row.course,
              lessonsCount: lessonCountMap.get(row.course.id) ?? 0,
            }
          : null,
        certificate: certificateMap.get(row.courseId) ?? null,
        refundRequest: refundRequestMap.get(row.id) ?? null,
      }));
  },

  async countEnrollments(courseId: number, tx?: DbConnection) {
    const conn = tx ?? db;
    const [result] = await conn
      .select({ count: count(enrollments.id) })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'ACTIVE')));

    return result?.count ?? 0;
  },

  async listCourseReviews(courseId: number, limit = 5) {
    return await db
      .select({
        id: courseReviews.id,
        rating: courseReviews.rating,
        title: courseReviews.title,
        body: courseReviews.body,
        createdAt: courseReviews.createdAt,
        updatedAt: courseReviews.updatedAt,
        reviewerName: users.fullName,
      })
      .from(courseReviews)
      .leftJoin(users, eq(users.id, courseReviews.userId))
      .where(eq(courseReviews.courseId, courseId))
      .orderBy(desc(courseReviews.createdAt), desc(courseReviews.id))
      .limit(limit);
  },

  async getCourseReviewStats(courseId: number) {
    const [row] = await db
      .select({
        reviewsCount: count(courseReviews.id),
        averageRating: avg(courseReviews.rating),
      })
      .from(courseReviews)
      .where(eq(courseReviews.courseId, courseId));

    return {
      reviewsCount: Number(row?.reviewsCount ?? 0),
      averageRating: Number(row?.averageRating ?? 0),
    };
  },

  async upsertCourseReview(data: {
    userId: number;
    courseId: number;
    rating: number;
    title?: string | null;
    body?: string | null;
  }) {
    const [review] = await db
      .insert(courseReviews)
      .values({
        courseId: data.courseId,
        userId: data.userId,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body ?? null,
      })
      .onConflictDoUpdate({
        target: [courseReviews.courseId, courseReviews.userId],
        set: {
          rating: data.rating,
          title: data.title ?? null,
          body: data.body ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return review;
  },

  async hasUserCompletedCourse(userId: number, courseId: number) {
    const lessonRows = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));

    const lessonIds = lessonRows
      .map((lesson) => lesson.id)
      .filter((id): id is number => Number.isFinite(Number(id)));

    if (lessonIds.length === 0) {
      return false;
    }

    const [completed] = await db
      .select({
        count: count(userLessonProgress.lessonId),
      })
      .from(userLessonProgress)
      .where(
        and(
          eq(userLessonProgress.userId, userId),
          eq(userLessonProgress.isCompleted, true),
          inArray(userLessonProgress.lessonId, lessonIds)
        )
      );

    const completedCount = Number(completed?.count ?? 0);
    return completedCount >= lessonIds.length;
  },

  async buildCourseDeletionMetadataMap(courseIds: number[], tx?: DbConnection) {
    if (courseIds.length === 0) {
      return new Map<number, CourseDeletionMetadata>();
    }

    const conn = tx ?? db;
    const [enrollmentSummary, certificateSummary, orderItemSummary] = await Promise.all([
      conn
        .select({
          courseId: enrollments.courseId,
          count: count(enrollments.id),
        })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds))
        .groupBy(enrollments.courseId),
      conn
        .select({
          courseId: certificates.courseId,
          count: count(certificates.id),
        })
        .from(certificates)
        .where(inArray(certificates.courseId, courseIds))
        .groupBy(certificates.courseId),
      conn
        .select({
          courseId: orderItems.courseId,
          count: count(orderItems.id),
        })
        .from(orderItems)
        .where(inArray(orderItems.courseId, courseIds))
        .groupBy(orderItems.courseId),
    ]);

    const enrollmentMap = new Map<number, number>(enrollmentSummary.map((row: any) => [row.courseId, Number(row.count ?? 0)]));
    const certificateMap = new Map<number, number>(certificateSummary.map((row: any) => [row.courseId, Number(row.count ?? 0)]));
    const orderItemMap = new Map<number, number>(orderItemSummary.map((row: any) => [row.courseId, Number(row.count ?? 0)]));
    const metadataMap = new Map<number, CourseDeletionMetadata>();

    for (const courseId of courseIds) {
      metadataMap.set(
        courseId,
        buildCourseDeletionMetadata({
          enrollmentsCount: enrollmentMap.get(courseId) ?? 0,
          certificatesCount: certificateMap.get(courseId) ?? 0,
          orderItemsCount: orderItemMap.get(courseId) ?? 0,
        })
      );
    }

    return metadataMap;
  },

  async attachCourseSummaries<T extends Array<any>>(
    courseRows: T,
    tx?: DbConnection,
    options?: { includeDeletionMetadata?: boolean },
  ): Promise<T> {
    if (courseRows.length === 0) {
      return courseRows;
    }

    const conn = tx ?? db;
    const courseIds = courseRows.map((course) => course.id);

    const enrollmentSummary = await conn
      .select({
        courseId: enrollments.courseId,
        count: count(enrollments.id),
      })
      .from(enrollments)
      .where(inArray(enrollments.courseId, courseIds))
      .groupBy(enrollments.courseId);

    const lessonSummary = await conn
      .select({
        courseId: lessons.courseId,
        count: count(lessons.id),
      })
      .from(lessons)
      .where(inArray(lessons.courseId, courseIds))
      .groupBy(lessons.courseId);

    const reviewSummary = await conn
      .select({
        courseId: courseReviews.courseId,
        reviewsCount: count(courseReviews.id),
        averageRating: avg(courseReviews.rating),
      })
      .from(courseReviews)
      .where(inArray(courseReviews.courseId, courseIds))
      .groupBy(courseReviews.courseId);
    const durationSummary = await conn
      .select({
        courseId: lessons.courseId,
        totalDurationSeconds: sql<number>`coalesce(sum(${videos.duration}), 0)`,
      })
      .from(lessons)
      .leftJoin(videos, eq(lessons.videoId, videos.id))
      .where(inArray(lessons.courseId, courseIds))
      .groupBy(lessons.courseId);

    const enrollmentMap = new Map(enrollmentSummary.map((row: any) => [row.courseId, row.count]));
    const lessonMap = new Map(lessonSummary.map((row: any) => [row.courseId, row.count]));
    const reviewMap = new Map<number, CourseReviewStatsSummary>(reviewSummary.map((row: any) => [row.courseId, {
      reviewsCount: Number(row.reviewsCount ?? 0),
      averageRating: Number(row.averageRating ?? 0),
    }]));
    const durationMap = new Map(durationSummary.map((row: any) => [row.courseId, Number(row.totalDurationSeconds ?? 0)]));
    const deletionMetadataMap = options?.includeDeletionMetadata
      ? await this.buildCourseDeletionMetadataMap(courseIds, tx)
      : new Map<number, CourseDeletionMetadata>();

    return courseRows.map((course) => {
      const reviewStats = reviewMap.get(course.id);
      const rating = reviewStats && reviewStats.reviewsCount > 0
        ? Number(reviewStats.averageRating.toFixed(1))
        : 0;

      return {
        ...course,
        enrolledCount: enrollmentMap.get(course.id) ?? 0,
        enrollmentsCount: enrollmentMap.get(course.id) ?? 0,
        lessonsCount: lessonMap.get(course.id) ?? 0,
        reviewsCount: reviewStats?.reviewsCount ?? 0,
        rating,
        totalDurationSeconds: Number(durationMap.get(course.id) ?? 0),
        durationMinutes: Math.round(Number(durationMap.get(course.id) ?? 0) / 60),
        ...(deletionMetadataMap.get(course.id) ?? {}),
      };
    }) as T;
  },

  async attachCourseDetails<T extends Record<string, any>>(
    course: T,
    tx?: DbConnection,
    options?: { includeDeletionMetadata?: boolean },
  ): Promise<T> {
    const conn = tx ?? db;
    const enrolledCount = await this.countEnrollments(course.id, tx);
    const deletionMetadata = options?.includeDeletionMetadata
      ? buildCourseDeletionMetadata(await this.getCourseDeletionBlockers(course.id))
      : null;

    const relatedLinks = await conn.query.courseRelatedCourses.findMany({
      where: eq(courseRelatedCourses.courseId, course.id),
      orderBy: [asc(courseRelatedCourses.sortOrder)],
      with: {
        relatedCourse: {
          with: {
            category: true,
            subcategory: true,
          },
        },
      },
    });

    const relatedCourseIds = relatedLinks.map((link: any) => link.relatedCourseId);
    const relatedEnrollmentMap = new Map<number, number>();

    if (relatedCourseIds.length > 0) {
      const relatedEnrollments = await conn
        .select({
          courseId: enrollments.courseId,
          count: count(enrollments.id),
        })
        .from(enrollments)
        .where(inArray(enrollments.courseId, relatedCourseIds))
        .groupBy(enrollments.courseId);

      relatedEnrollments.forEach((item: any) => {
        relatedEnrollmentMap.set(item.courseId, item.count);
      });
    }

    const relatedDurationMap = new Map<number, number>();

    if (relatedCourseIds.length > 0) {
      const relatedDurationSummary = await conn
        .select({
          courseId: lessons.courseId,
          totalDurationSeconds: sql<number>`coalesce(sum(${videos.duration}), 0)`,
        })
        .from(lessons)
        .leftJoin(videos, eq(lessons.videoId, videos.id))
        .where(inArray(lessons.courseId, relatedCourseIds))
        .groupBy(lessons.courseId);

      relatedDurationSummary.forEach((item: any) => {
        relatedDurationMap.set(item.courseId, Number(item.totalDurationSeconds ?? 0));
      });
    }

    const totalDurationSeconds = Array.isArray(course.lessons)
      ? course.lessons.reduce((sum: number, lesson: any) => sum + Number(lesson.video?.duration ?? 0), 0)
      : 0;

    const relatedCourses = relatedLinks
      .map((link: any) => link.relatedCourse)
      .filter(Boolean)
      .map((relatedCourse: any) => ({
        ...relatedCourse,
        enrolledCount: relatedEnrollmentMap.get(relatedCourse.id) ?? 0,
        enrollmentsCount: relatedEnrollmentMap.get(relatedCourse.id) ?? 0,
        totalDurationSeconds: Number(relatedDurationMap.get(relatedCourse.id) ?? 0),
        durationMinutes: Math.round(Number(relatedDurationMap.get(relatedCourse.id) ?? 0) / 60),
      }));

    const finalExam = await this.getExamByCourseId(course.id);
    const reviewStats = await this.getCourseReviewStats(course.id);
    const averageRating =
      reviewStats.reviewsCount > 0
        ? Number(reviewStats.averageRating.toFixed(1))
        : Number(course.rating ?? 0);

    return {
      ...course,
      enrolledCount,
      enrollmentsCount: enrolledCount,
      relatedCourses,
      relatedCourseIds: relatedCourses.map((relatedCourse: any) => relatedCourse.id),
      lessonsCount: Array.isArray(course.lessons) ? course.lessons.length : 0,
      totalDurationSeconds,
      durationMinutes: Math.round(totalDurationSeconds / 60),
      lessons: Array.isArray(course.lessons)
        ? course.lessons.map((lesson: any) => ({
            ...lesson,
            documents: lesson.documents ?? [],
            lessonQuiz: Array.isArray(lesson.lessonQuizzes) ? lesson.lessonQuizzes[0] ?? null : null,
            hasQuiz: Array.isArray(lesson.lessonQuizzes) ? lesson.lessonQuizzes.length > 0 : false,
            documentsCount: Array.isArray(lesson.documents) ? lesson.documents.length : 0,
          }))
        : [],
      exam: finalExam,
      reviewsCount: reviewStats.reviewsCount,
      rating: Number.isFinite(averageRating) ? averageRating : 0,
      ...(deletionMetadata ?? {}),
    } as T;
  },
};
