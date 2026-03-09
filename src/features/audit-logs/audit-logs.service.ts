import { auditLogsRepository } from './audit-logs.repository.js';
import type { ListAuditLogsQuery, CreateAuditLogInput } from './audit-logs.schema.js';

export const auditLogsService = {
  async listLogs(query: ListAuditLogsQuery) {
    return await auditLogsRepository.listLogs(query);
  },

  /**
   * Helper method to record an admin action from anywhere in the system
   */
  async recordAction(data: CreateAuditLogInput) {
    try {
      return await auditLogsRepository.createLog(data);
    } catch (error) {
      // We don't want audit logging to crash the main operation, 
      // but we should at least log the error to console
      console.error('Failed to record audit log:', error);
    }
  }
};

