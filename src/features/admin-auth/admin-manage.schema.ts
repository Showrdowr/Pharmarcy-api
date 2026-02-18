import { z } from 'zod';

// Schema สำหรับสร้าง officer account (เฉพาะ admin เท่านั้น)
export const createOfficerSchema = z.object({
  username: z.string().min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร').max(100),
  email: z.string().email('กรุณากรอกอีเมลที่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
});

export type CreateOfficerInput = z.infer<typeof createOfficerSchema>;

// Params schema for :id routes
export const adminUserParamsSchema = z.object({
  id: z.string().uuid('ID ต้องเป็น UUID'),
});

export type AdminUserParams = z.infer<typeof adminUserParamsSchema>;
