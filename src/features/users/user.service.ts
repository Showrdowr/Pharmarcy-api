import { CreateUserInput, UpdateUserInput } from './user.schema.js';
import { userRepository } from './user.repository.js';
import bcrypt from 'bcrypt';

// Password hashing using bcrypt (consistent with auth.service.ts)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// กรองข้อมูลที่อ่อนไหว (passwordHash, resetOtp) ออกก่อนส่งให้ Client
function stripSensitiveFields(user: any) {
  if (!user) return user;
  const { passwordHash, resetOtp, resetOtpExpiresAt, ...safeUser } = user;
  return safeUser;
}

export const userService = {
  async getAllUsers(filters: { role?: any; limit?: number; offset?: number; search?: string; status?: 'active' | 'inactive' } = {}) {
    const users = await userRepository.findAllWithFilters(filters);
    const stats = await userRepository.getStats(filters.role, filters.search, filters.status);
    return { users, stats };
  },

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return stripSensitiveFields(user);
  },

  async createUser(input: CreateUserInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
    });
    return stripSensitiveFields(user);
  },

  async updateUser(id: number, input: UpdateUserInput) {
    const user = await userRepository.update(id, input);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return stripSensitiveFields(user);
  },

  async deleteUser(id: number) {
    const deleted = await userRepository.delete(id);
    if (!deleted) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return { success: true };
  },
};
