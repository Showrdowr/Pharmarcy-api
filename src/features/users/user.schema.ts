import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
});

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true });

export const userParamsSchema = z.object({
  id: z.coerce.number(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
