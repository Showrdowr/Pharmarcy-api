import { CreateUserInput, UpdateUserInput } from './user.schema.js';
import { userRepository } from './user.repository.js';
import { createHash } from 'crypto';

// Simple password hashing (for production use bcrypt instead)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
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
    return user;
  },

  async createUser(input: CreateUserInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
    }

    const passwordHash = hashPassword(input.password);
    return userRepository.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
    });
  },

  async updateUser(id: number, input: UpdateUserInput) {
    const user = await userRepository.update(id, input);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return user;
  },

  async deleteUser(id: number) {
    const deleted = await userRepository.delete(id);
    if (!deleted) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return { success: true };
  },
};
