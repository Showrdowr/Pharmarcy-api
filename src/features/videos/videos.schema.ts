import { z } from 'zod';

export const videoListQuerySchema = z.object({
  search: z.string().optional(),
  provider: z.enum(['YOUTUBE', 'VIMEO', 'CLOUDFLARE', 'S3']).optional(),
  status: z.enum(['PROCESSING', 'READY', 'FAILED']).optional(),
  used: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});

export const videoIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type VideoListQuery = z.infer<typeof videoListQuerySchema>;
export type VideoIdParams = z.infer<typeof videoIdParamsSchema>;
