import { FastifyRequest, FastifyReply } from 'fastify';
import { examsRepository } from './exams.repository.js';
import type { CreateExamInput, UpdateExamInput, CreateExamQuestionInput, UpdateExamQuestionInput } from './exams.schema.js';

export const examsController = {
  async getExamByCourse(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const exam = await examsRepository.getByCourseId(request.params.id);
    if (!exam) {
      return reply.send({ data: null });
    }
    return reply.send({ data: exam });
  },

  async createExam(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateExamInput }>,
    reply: FastifyReply
  ) {
    const exam = await examsRepository.create(request.params.id, request.body);
    return reply.status(201).send({ data: exam });
  },

  async updateExam(
    request: FastifyRequest<{ Params: { id: number }; Body: UpdateExamInput }>,
    reply: FastifyReply
  ) {
    const exam = await examsRepository.update(request.params.id, request.body);
    if (!exam) {
      return reply.status(404).send({ message: 'Exam not found' });
    }
    return reply.send({ data: exam });
  },

  async deleteExam(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    await examsRepository.delete(request.params.id);
    return reply.status(204).send();
  },

  async addQuestion(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateExamQuestionInput }>,
    reply: FastifyReply
  ) {
    const question = await examsRepository.addQuestion(request.params.id, request.body);
    return reply.status(201).send({ data: question });
  },

  async updateQuestion(
    request: FastifyRequest<{ Params: { questionId: number }; Body: UpdateExamQuestionInput }>,
    reply: FastifyReply
  ) {
    const question = await examsRepository.updateQuestion(request.params.questionId, request.body);
    if (!question) {
      return reply.status(404).send({ message: 'Question not found' });
    }
    return reply.send({ data: question });
  },

  async deleteQuestion(
    request: FastifyRequest<{ Params: { questionId: number } }>,
    reply: FastifyReply
  ) {
    await examsRepository.deleteQuestion(request.params.questionId);
    return reply.status(204).send();
  },
};
