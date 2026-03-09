import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 10),
  adminId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetTable: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface CreateAuditLogInput {
  adminId: string;
  action: string;
  targetTable?: string;
  targetId?: string; // Keep as string for input, will try to convert to UUID for DB if needed
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}

