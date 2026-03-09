import { z } from 'zod';

export const listLoginLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  adminId: z.string().uuid().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  startDate: z.string().optional(), // ISO string
  endDate: z.string().optional(),   // ISO string
  search: z.string().optional(),
});

export type ListLoginLogsQuery = z.infer<typeof listLoginLogsQuerySchema>;

export interface CreateLoginLogInput {
  adminId?: string;
  status: 'SUCCESS' | 'FAILED';
  ipAddress?: string;
  userAgent?: string;
}
