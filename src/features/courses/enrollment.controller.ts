import { FastifyRequest, FastifyReply } from 'fastify';
import { enrollmentService } from './enrollment.service.js';

function withThumbnailUrl(baseUrl: string, course: any) {
  return {
    ...course,
    thumbnail: course.thumbnail ? `${baseUrl}/api/v1/courses/${course.id}/thumbnail` : null,
  };
}

export const enrollmentController = {
  async enroll(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as { id: number }).id;
    const courseId = request.params.id;

    const result = await enrollmentService.enrollCourse(userId, courseId);

    if (result.error) {
      return reply.status(result.status!).send({ success: false, error: result.error });
    }

    return reply.status(201).send({ success: true, data: result.data });
  },

  async getEnrolledCourses(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const userId = (request.user as { id: number }).id;
    const courses = await enrollmentService.getEnrolledCourses(userId);
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    return reply.send({ success: true, data: courses.map(course => withThumbnailUrl(baseUrl, course)) });
  },

  async getCourseProgress(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as { id: number }).id;
    const courseId = request.params.id;

    const result = await enrollmentService.getCourseProgress(userId, courseId);

    if (result.error) {
      return reply.status(result.status!).send({ success: false, error: result.error });
    }

    return reply.send({ success: true, data: result.data });
  },

  async markLessonComplete(
    request: FastifyRequest<{ Params: { id: number; lessonId: number } }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as { id: number }).id;
    const courseId = request.params.id;
    const lessonId = request.params.lessonId;

    const result = await enrollmentService.markLessonComplete(userId, courseId, lessonId);

    if (result.error) {
      return reply.status(result.status!).send({ success: false, error: result.error });
    }

    return reply.send({ success: true, data: result.data });
  },

  async getFeaturedCourses(
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 6;
    const courses = await enrollmentService.getFeaturedCourses(limit);
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    return reply.send({ success: true, data: courses.map(course => withThumbnailUrl(baseUrl, course)) });
  },

  async getPopularCourses(
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 8;
    const courses = await enrollmentService.getPopularCourses(limit);
    const baseUrl = `${request.protocol}://${request.headers.host}`;
    return reply.send({ success: true, data: courses.map(course => withThumbnailUrl(baseUrl, course)) });
  },
};
