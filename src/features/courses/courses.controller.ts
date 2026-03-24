import { FastifyReply, FastifyRequest } from 'fastify';
import { coursesService } from './courses.service.js';
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
  ReviewListQueryInput,
  CreateCourseReviewInput,
  VideoListQueryInput,
} from './courses.schema.js';

function getAdminId(request: FastifyRequest) {
  return (request.user as any)?.id as string | undefined;
}

function getUserId(request: FastifyRequest) {
  return Number((request.user as any)?.id);
}

function parseCourseListFilters(query: { categoryId?: string; search?: string; limit?: string }) {
  const categoryId = query.categoryId ? parseInt(query.categoryId, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;

  return {
    categoryId: Number.isNaN(categoryId) ? undefined : categoryId,
    search: query.search?.trim() || undefined,
    limit: Number.isNaN(limit) ? undefined : limit,
  };
}

function parseVideoListFilters(query: VideoListQueryInput) {
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 20;

  return {
    search: query.search?.trim() || undefined,
    provider: query.provider,
    status: query.status,
    used: query.used === 'true' ? true : query.used === 'false' ? false : undefined,
    page: Number.isNaN(page) ? 1 : Math.max(1, page),
    limit: Number.isNaN(limit) ? 20 : Math.min(100, Math.max(1, limit)),
  };
}

function parseReviewLimit(query: ReviewListQueryInput) {
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;
  if (!limit || Number.isNaN(limit)) {
    return undefined;
  }
  return Math.min(20, Math.max(1, limit));
}

export const coursesController = {
  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await coursesService.listCategories();
    return reply.send({ data: categories });
  },

  async listPublicCategories(request: FastifyRequest, reply: FastifyReply) {
    const categories = await coursesService.listPublicCategories();
    return reply.send({ data: categories });
  },

  async getCategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const category = await coursesService.getCategory(request.params.id);
    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ data: category });
  },

  async createCategory(request: FastifyRequest<{ Body: CreateCategoryInput }>, reply: FastifyReply) {
    const category = await coursesService.createCategory(request.body, getAdminId(request), request.ip);
    return reply.status(201).send({ data: category });
  },

  async updateCategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCategoryInput }>, reply: FastifyReply) {
    const category = await coursesService.updateCategory(request.params.id, request.body, getAdminId(request), request.ip);
    if (!category) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ data: category });
  },

  async deleteCategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteCategory(request.params.id, getAdminId(request), request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Category not found' });
    }
    return reply.send({ message: 'Category deleted successfully' });
  },

  async listSubcategories(request: FastifyRequest<{ Querystring: { categoryId?: string } }>, reply: FastifyReply) {
    const categoryId = request.query.categoryId ? parseInt(request.query.categoryId, 10) : undefined;
    const subcategories = await coursesService.listSubcategories(categoryId);
    return reply.send({ data: subcategories });
  },

  async getSubcategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const subcategory = await coursesService.getSubcategory(request.params.id);
    if (!subcategory) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ data: subcategory });
  },

  async createSubcategory(request: FastifyRequest<{ Body: CreateSubcategoryInput }>, reply: FastifyReply) {
    const subcategory = await coursesService.createSubcategory(request.body, getAdminId(request), request.ip);
    return reply.status(201).send({ data: subcategory });
  },

  async updateSubcategory(request: FastifyRequest<{ Params: { id: number }; Body: UpdateSubcategoryInput }>, reply: FastifyReply) {
    const subcategory = await coursesService.updateSubcategory(request.params.id, request.body, getAdminId(request), request.ip);
    if (!subcategory) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ data: subcategory });
  },

  async deleteSubcategory(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteSubcategory(request.params.id, getAdminId(request), request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Subcategory not found' });
    }
    return reply.send({ message: 'Subcategory deleted successfully' });
  },

  async listPublicCourses(
    request: FastifyRequest<{ Querystring: { categoryId?: string; search?: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const courses = await coursesService.listPublishedCourses(parseCourseListFilters(request.query));
    return reply.send({ data: courses });
  },

  async getPublicCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getPublishedCourse(request.params.id);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async getCourseReviews(
    request: FastifyRequest<{ Params: { id: number }; Querystring: ReviewListQueryInput }>,
    reply: FastifyReply
  ) {
    const limit = parseReviewLimit(request.query);
    const reviews = await coursesService.getCourseReviews(request.params.id, limit);
    return reply.send({ data: reviews });
  },

  async listCourses(
    request: FastifyRequest<{ Querystring: { categoryId?: string; search?: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const courses = await coursesService.listCourses(parseCourseListFilters(request.query));
    return reply.send({ data: courses });
  },

  async listEnrolledCourses(request: FastifyRequest, reply: FastifyReply) {
    const courses = await coursesService.listEnrolledCourses(getUserId(request));
    return reply.send({ data: courses });
  },

  async getCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getCourse(request.params.id);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async getCourseLearning(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const course = await coursesService.getCourseLearning(request.params.id, getUserId(request));
    return reply.send({ data: course });
  },

  async getCourseProgress(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const progress = await coursesService.getCourseProgress(request.params.id, getUserId(request));
    return reply.send({ data: progress });
  },

  async getCourseReviewEligibility(
    request: FastifyRequest<{ Params: { courseId: number } }>,
    reply: FastifyReply
  ) {
    const eligibility = await coursesService.getCourseReviewEligibility(request.params.courseId, getUserId(request));
    return reply.send({ data: eligibility });
  },

  async createCourseReview(
    request: FastifyRequest<{ Params: { courseId: number }; Body: CreateCourseReviewInput }>,
    reply: FastifyReply
  ) {
    const review = await coursesService.submitCourseReview(request.params.courseId, getUserId(request), request.body);
    return reply.status(201).send({ data: review });
  },

  async createCourse(request: FastifyRequest<{ Body: CreateCourseInput }>, reply: FastifyReply) {
    const course = await coursesService.createCourse(request.body, getAdminId(request), request.ip);
    return reply.status(201).send({ data: course });
  },

  async updateCourse(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCourseInput }>, reply: FastifyReply) {
    const course = await coursesService.updateCourse(request.params.id, request.body, getAdminId(request), request.ip);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async deleteCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const result = await coursesService.deleteCourse(request.params.id, getAdminId(request), request.ip);
    if (!result) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ message: 'Course deleted successfully' });
  },

  async listLessons(request: FastifyRequest<{ Params: { courseId: number } }>, reply: FastifyReply) {
    const lessons = await coursesService.listLessons(request.params.courseId);
    return reply.send({ data: lessons });
  },

  async createLesson(request: FastifyRequest<{ Params: { courseId: number }; Body: CreateLessonInput }>, reply: FastifyReply) {
    const lesson = await coursesService.createLesson(request.params.courseId, request.body);
    return reply.status(201).send({ data: lesson });
  },

  async updateLesson(request: FastifyRequest<{ Params: { id: number }; Body: UpdateLessonInput }>, reply: FastifyReply) {
    const lesson = await coursesService.updateLesson(request.params.id, request.body);
    if (!lesson) {
      return reply.status(404).send({ message: 'Lesson not found' });
    }
    return reply.send({ data: lesson });
  },

  async deleteLesson(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const lesson = await coursesService.deleteLesson(request.params.id);
    if (!lesson) {
      return reply.status(404).send({ message: 'Lesson not found' });
    }
    return reply.send({ message: 'Lesson deleted successfully' });
  },

  async addLessonDocument(request: FastifyRequest<{ Params: { id: number }; Body: CreateLessonDocumentInput }>, reply: FastifyReply) {
    const document = await coursesService.addLessonDocument(request.params.id, request.body);
    return reply.status(201).send({ data: document });
  },

  async deleteLessonDocument(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const document = await coursesService.deleteLessonDocument(request.params.id);
    if (!document) {
      return reply.status(404).send({ message: 'Lesson document not found' });
    }
    return reply.send({ message: 'Lesson document deleted successfully' });
  },

  async addVideoQuestion(request: FastifyRequest<{ Params: { id: number }; Body: CreateVideoQuestionInput }>, reply: FastifyReply) {
    const question = await coursesService.addVideoQuestion(request.params.id, request.body);
    return reply.status(201).send({ data: question });
  },

  async addVideoQuestionsBulk(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateVideoQuestionBulkInput }>,
    reply: FastifyReply
  ) {
    const questions = await coursesService.addVideoQuestionsBulk(request.params.id, request.body);
    return reply.status(201).send({ data: questions });
  },

  async deleteVideoQuestion(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const question = await coursesService.deleteVideoQuestion(request.params.id);
    if (!question) {
      return reply.status(404).send({ message: 'Video question not found' });
    }
    return reply.send({ message: 'Video question deleted successfully' });
  },

  async updateVideoQuestion(
    request: FastifyRequest<{ Params: { id: number }; Body: UpdateVideoQuestionInput }>,
    reply: FastifyReply
  ) {
    const question = await coursesService.updateVideoQuestion(request.params.id, request.body);
    if (!question) {
      return reply.status(404).send({ message: 'Video question not found' });
    }
    return reply.send({ data: question });
  },

  async answerVideoQuestion(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateVideoQuestionAnswerInput }>,
    reply: FastifyReply
  ) {
    const answer = await coursesService.answerVideoQuestion(request.params.id, getUserId(request), request.body);
    return reply.status(201).send({ data: answer });
  },

  async updateLessonProgress(
    request: FastifyRequest<{ Params: { id: number }; Body: UpdateLessonProgressInput }>,
    reply: FastifyReply
  ) {
    const progress = await coursesService.updateLessonProgress(request.params.id, getUserId(request), request.body);
    return reply.send({ data: progress });
  },

  async completeLesson(
    request: FastifyRequest<{ Params: { courseId: number; lessonId: number } }>,
    reply: FastifyReply
  ) {
    const progress = await coursesService.completeLesson(request.params.courseId, request.params.lessonId, getUserId(request));
    return reply.send({ data: progress });
  },

  async getLessonQuiz(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const quiz = await coursesService.getLessonQuiz(request.params.id);
    return reply.send({ data: quiz });
  },

  async upsertLessonQuiz(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateLessonQuizInput | UpdateLessonQuizInput }>,
    reply: FastifyReply
  ) {
    const quiz = await coursesService.upsertLessonQuiz(request.params.id, request.body);
    return reply.send({ data: quiz });
  },

  async createLessonQuizQuestion(
    request: FastifyRequest<{ Params: { quizId: number }; Body: CreateLessonQuizQuestionInput }>,
    reply: FastifyReply
  ) {
    const question = await coursesService.createLessonQuizQuestion(request.params.quizId, request.body);
    return reply.status(201).send({ data: question });
  },

  async updateLessonQuizQuestion(
    request: FastifyRequest<{ Params: { questionId: number }; Body: UpdateLessonQuizQuestionInput }>,
    reply: FastifyReply
  ) {
    const question = await coursesService.updateLessonQuizQuestion(request.params.questionId, request.body);
    if (!question) {
      return reply.status(404).send({ message: 'Lesson quiz question not found' });
    }
    return reply.send({ data: question });
  },

  async deleteLessonQuizQuestion(request: FastifyRequest<{ Params: { questionId: number } }>, reply: FastifyReply) {
    const question = await coursesService.deleteLessonQuizQuestion(request.params.questionId);
    if (!question) {
      return reply.status(404).send({ message: 'Lesson quiz question not found' });
    }
    return reply.send({ message: 'Lesson quiz question deleted successfully' });
  },

  async replaceRelatedCourses(request: FastifyRequest<{ Params: { id: number }; Body: UpdateCourseRelatedInput }>, reply: FastifyReply) {
    const course = await coursesService.replaceRelatedCourses(request.params.id, request.body);
    if (!course) {
      return reply.status(404).send({ message: 'Course not found' });
    }
    return reply.send({ data: course });
  },

  async getExam(request: FastifyRequest<{ Params: { courseId: number } }>, reply: FastifyReply) {
    const exam = await coursesService.getExam(request.params.courseId);
    return reply.send({ data: exam });
  },

  async saveExam(request: FastifyRequest<{ Params: { courseId: number }; Body: CreateExamInput }>, reply: FastifyReply) {
    const exam = await coursesService.saveExam(request.params.courseId, request.body);
    return reply.send({ data: exam });
  },

  async updateExam(request: FastifyRequest<{ Params: { id: number }; Body: UpdateExamInput }>, reply: FastifyReply) {
    const exam = await coursesService.updateExam(request.params.id, request.body);
    if (!exam) {
      return reply.status(404).send({ message: 'Exam not found' });
    }
    return reply.send({ data: exam });
  },

  async deleteExam(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const exam = await coursesService.deleteExam(request.params.id);
    if (!exam) {
      return reply.status(404).send({ message: 'Exam not found' });
    }
    return reply.send({ message: 'Exam deleted successfully' });
  },

  async addExamQuestion(request: FastifyRequest<{ Params: { id: number }; Body: CreateExamQuestionInput }>, reply: FastifyReply) {
    const question = await coursesService.addExamQuestion(request.params.id, request.body);
    return reply.status(201).send({ data: question });
  },

  async updateExamQuestion(request: FastifyRequest<{ Params: { id: number }; Body: UpdateExamQuestionInput }>, reply: FastifyReply) {
    const question = await coursesService.updateExamQuestion(request.params.id, request.body);
    if (!question) {
      return reply.status(404).send({ message: 'Exam question not found' });
    }
    return reply.send({ data: question });
  },

  async deleteExamQuestion(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const question = await coursesService.deleteExamQuestion(request.params.id);
    if (!question) {
      return reply.status(404).send({ message: 'Exam question not found' });
    }
    return reply.send({ message: 'Exam question deleted successfully' });
  },

  async initiateVideoUpload(request: FastifyRequest<{ Body: CreateVideoUploadInitiateInput }>, reply: FastifyReply) {
    const uploadSession = await coursesService.initiateVideoUpload(request.body);
    return reply.send({ data: uploadSession });
  },

  async listVideos(request: FastifyRequest<{ Querystring: VideoListQueryInput }>, reply: FastifyReply) {
    const videos = await coursesService.listVideos(parseVideoListFilters(request.query));
    return reply.send({ data: videos });
  },

  async getVideo(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const video = await coursesService.getVideo(request.params.id);
    if (!video) {
      return reply.status(404).send({ message: 'Video not found' });
    }
    return reply.send({ data: video });
  },

  async completeVideoUpload(request: FastifyRequest<{ Body: CompleteVideoUploadInput }>, reply: FastifyReply) {
    const video = await coursesService.completeVideoUpload(request.body);
    return reply.status(201).send({ data: video });
  },

  async resolveVimeoVideo(request: FastifyRequest<{ Body: ResolveVimeoVideoInput }>, reply: FastifyReply) {
    const result = await coursesService.resolveVimeoVideo(request.body);
    return reply.send({ data: result });
  },

  async importVimeoVideo(request: FastifyRequest<{ Body: ImportVimeoVideoInput }>, reply: FastifyReply) {
    const video = await coursesService.importVimeoVideo(request.body);
    return reply.status(201).send({ data: video });
  },

  async deleteVideo(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const video = await coursesService.deleteVideo(request.params.id);
    if (!video) {
      return reply.status(404).send({ message: 'Video not found' });
    }
    return reply.send({ message: 'Video deleted successfully' });
  },

  async syncVideoStatus(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const video = await coursesService.syncVideoStatus(request.params.id);
    if (!video) {
      return reply.status(404).send({ message: 'Video not found' });
    }
    return reply.send({ data: video });
  },

  async enrollCourse(request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) {
    const enrollment = await coursesService.enrollCourse(request.params.id, getUserId(request));
    return reply.status(201).send({ data: enrollment });
  },
};
