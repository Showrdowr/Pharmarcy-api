import { FastifyRequest, FastifyReply } from 'fastify';
import { gradingRepository } from './grading.repository.js';
import type { GradingQuery, AttemptParams, SubmitGradesBody } from './grading.schema.js';

export const gradingController = {
  async getPendingAttempts(
    request: FastifyRequest<{ Querystring: GradingQuery }>,
    reply: FastifyReply
  ) {
    const result = await gradingRepository.getPendingAttempts({
      courseId: request.query.courseId,
      examId: request.query.examId,
      page: request.query.page,
      limit: request.query.limit,
    });
    return reply.send({ data: result });
  },

  async getGradingDetail(
    request: FastifyRequest<{ Params: AttemptParams }>,
    reply: FastifyReply
  ) {
    const detail = await gradingRepository.getGradingDetail(request.params.attemptId);
    if (!detail) {
      return reply.status(404).send({ message: 'Attempt not found' });
    }
    return reply.send({ data: detail });
  },

  async submitGrades(
    request: FastifyRequest<{ Params: AttemptParams; Body: SubmitGradesBody }>,
    reply: FastifyReply
  ) {
    const result = await gradingRepository.submitGrades(
      request.params.attemptId,
      request.body.gradedAnswers
    );
    return reply.send({ data: result });
  },
};
