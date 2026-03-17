import { FastifyRequest, FastifyReply } from 'fastify';
import { cpeCreditsRepository } from './cpe-credits.repository.js';
import type { CpeQuery } from './cpe-credits.schema.js';

export const cpeCreditsController = {
  async getRecords(
    request: FastifyRequest<{ Querystring: CpeQuery }>,
    reply: FastifyReply
  ) {
    const result = await cpeCreditsRepository.getRecords({
      page: request.query.page,
      limit: request.query.limit,
      search: request.query.search,
    });
    return reply.send({ data: result });
  },

  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const stats = await cpeCreditsRepository.getStats();
    return reply.send({ data: stats });
  },
};
