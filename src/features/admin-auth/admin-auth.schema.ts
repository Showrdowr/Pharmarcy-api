import { z } from 'zod';

// Login schema
export const adminLoginSchema = z.object({
  email: z.string().email('กรุณากรอกอีเมลที่ถูกต้อง'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// JWT token payload type
export interface AdminTokenPayload {
  id: string;       // uuid
  email: string;
  username: string;
  role: string;     // 'admin' | 'officer'
}
