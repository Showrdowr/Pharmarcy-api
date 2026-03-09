import { adminLoginLogsRepository } from './admin-login-logs.repository.js';
import type { ListLoginLogsQuery, CreateLoginLogInput } from './admin-login-logs.schema.js';

export const adminLoginLogsService = {
  async listLogs(query: ListLoginLogsQuery) {
    return await adminLoginLogsRepository.listLogs(query);
  },

  async recordLogin(data: CreateLoginLogInput) {
    try {
      return await adminLoginLogsRepository.createLog(data);
    } catch (error) {
      console.error('Failed to record login log:', error);
      // Don't throw error to avoid breaking login flow
      return null;
    }
  }
};
