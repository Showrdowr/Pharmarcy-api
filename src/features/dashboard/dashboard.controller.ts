import { FastifyReply, FastifyRequest } from 'fastify';
import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  async getDashboardData(request: FastifyRequest, reply: FastifyReply) {
    const data = await dashboardService.getDashboardData();
    return reply.send({ data });
  },
};
