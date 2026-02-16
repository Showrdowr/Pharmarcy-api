import bcrypt from 'bcrypt';
import { userRepository } from '../users/user.repository.js';
import { LoginInput, RegisterInput } from './auth.schema.js';

export const authService = {
  async login(data: LoginInput) {
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 401 });
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    return user;
  },

  async register(data: RegisterInput) {
    console.log('Checking if email exists:', data.email);
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      console.log('Email already exists:', data.email);
      throw Object.assign(new Error('Email already exists'), { statusCode: 409 });
    }

    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cast string role to enum type as expected by repository/schema
    // In a real app we might validate against the enum values at runtime too
    const role = data.role as "member" | "pharmacist" | "admin";

    console.log('Creating user in DB...', { ...data, password: '***' });
    const user = await userRepository.create({
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      role,
      professionalLicenseNumber: data.professionalLicenseNumber,
    });
    console.log('User created:', user);

    return user;
  },
};
