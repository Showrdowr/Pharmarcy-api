import { FastifyReply, FastifyRequest } from 'fastify';
import { auditLogsService } from './audit-logs.service.js';
import type { ListAuditLogsQuery } from './audit-logs.schema.js';

export const auditLogsController = {
  async getLogs(request: FastifyRequest<{ Querystring: ListAuditLogsQuery }>, reply: FastifyReply) {
    const result = await auditLogsService.listLogs(request.query);
    return reply.send({ data: result, success: true });
  }
};

