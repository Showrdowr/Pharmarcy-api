import { z } from 'zod';

// Schema สำหรับสร้าง officer account (เฉพาะ admin เท่านั้น)
export const createOfficerSchema = z.object({
  email: z.string().email('กรุณากรอกอีเมลที่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
  role: z.string().min(1, 'กรุณาเลือกสิทธิ์การเข้าถึง'),
  department: z.string().min(2, 'ชื่อแผนกต้องมีอย่างน้อย 2 ตัวอักษร').optional(),
  major: z.string().optional(),
  confirmPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านเพื่อยืนยัน'),
});

export type CreateOfficerInput = z.infer<typeof createOfficerSchema>;

// Params schema for :id routes
export const adminUserParamsSchema = z.object({
  id: z.string().uuid('ID ต้องเป็น UUID'),
});

export type AdminUserParams = z.infer<typeof adminUserParamsSchema>;

// Body schema for delete (requires password confirmation)
export const deleteAdminBodySchema = z.object({
  confirmPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านเพื่อยืนยัน'),
});

export type DeleteAdminBody = z.infer<typeof deleteAdminBodySchema>;
