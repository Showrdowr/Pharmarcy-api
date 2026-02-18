import bcrypt from 'bcrypt';
import { adminAuthRepository } from './admin-auth.repository.js';
import { AdminLoginInput } from './admin-auth.schema.js';

export const adminAuthService = {
  async login(data: AdminLoginInput) {
    const admin = await adminAuthRepository.findByEmail(data.email);
    if (!admin) {
      throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { statusCode: 401 });
    }

    const isValid = await bcrypt.compare(data.password, admin.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { statusCode: 401 });
    }

    return admin;
  },
};
