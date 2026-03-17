import { z } from 'zod';

export const orderParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']),
});

export const cancelOrderSchema = z.object({
  reason: z.string().optional(),
});

export const refundOrderSchema = z.object({
  amount: z.number().min(0),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
