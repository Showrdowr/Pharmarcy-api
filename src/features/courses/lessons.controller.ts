import { FastifyRequest, FastifyReply } from 'fastify';
import { lessonsRepository } from './lessons.repository.js';
import type { CreateLessonInput, UpdateLessonInput } from './courses.schema.js';

export const lessonsController = {
  async listLessons(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) {
    const lessons = await lessonsRepository.listByCourseId(request.params.id);
    return reply.send({ data: lessons });
  },

  async createLesson(
    request: FastifyRequest<{ Params: { id: number }; Body: CreateLessonInput }>,
    reply: FastifyReply
  ) {
    const lesson = await lessonsRepository.create(request.params.id, request.body);
    return reply.status(201).send({ data: lesson });
  },

  async updateLesson(
    request: FastifyRequest<{ Params: { lessonId: number }; Body: UpdateLessonInput }>,
    reply: FastifyReply
  ) {
    const lesson = await lessonsRepository.update(request.params.lessonId, request.body);
    if (!lesson) {
      return reply.status(404).send({ message: 'Lesson not found' });
    }
    return reply.send({ data: lesson });
  },

  async deleteLesson(
    request: FastifyRequest<{ Params: { lessonId: number } }>,
    reply: FastifyReply
  ) {
    await lessonsRepository.delete(request.params.lessonId);
    return reply.status(204).send();
  },
};
