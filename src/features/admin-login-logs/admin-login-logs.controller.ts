import { FastifyReply, FastifyRequest } from 'fastify';
import { adminLoginLogsService } from './admin-login-logs.service.js';
import { listLoginLogsQuerySchema, type ListLoginLogsQuery } from './admin-login-logs.schema.js';

export const adminLoginLogsController = {
  async getLogs(request: FastifyRequest<{ Querystring: ListLoginLogsQuery }>, reply: FastifyReply) {
    const query = listLoginLogsQuerySchema.parse(request.query);
    const result = await adminLoginLogsService.listLogs(query);
    return reply.send({ data: result, success: true });
  }
};
