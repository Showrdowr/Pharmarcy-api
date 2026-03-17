import { z } from 'zod';

export const cpeQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CpeQuery = z.infer<typeof cpeQuerySchema>;
