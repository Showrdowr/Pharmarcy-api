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

    if (filters.role === 'pharmacist') {
      const userIds = users.map((user) => Number(user.id));
      const earnedCpeCreditsMap = await userRepository.getEarnedCpeCreditsByUserIds(userIds);
      const cpeSummary = await userRepository.getRoleCpeSummary('pharmacist');

      return {
        users: users.map((user) => ({
          ...user,
          earnedCpeCredits: earnedCpeCreditsMap.get(Number(user.id)) ?? 0,
        })),
        stats: {
          ...stats,
          totalCpeCredits: cpeSummary.totalCredits,
          averageCpeCredits: stats.total > 0 ? Number((cpeSummary.totalCredits / stats.total).toFixed(2)) : 0,
        },
      };
    }

    return { users, stats };
  },

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return user;
  },

  async getUserOverview(id: number) {
    const user = await this.getUserById(id);
    const [enrollmentRows, orderRows, certificateRows, totalSpent] = await Promise.all([
      userRepository.listEnrollmentsByUserId(id),
      userRepository.listOrderHistoryByUserId(id),
      userRepository.listCertificatesByUserId(id),
      userRepository.getTotalSpentByUserId(id),
    ]);

    const enrollments = enrollmentRows.map((row) => ({
      id: String(row.enrollmentId),
      courseId: String(row.courseId),
      courseTitle: row.courseTitle,
      watchPercent: Number(row.watchPercent ?? 0),
      completionPercent: Number(row.completionPercent ?? 0),
      isCompleted: Boolean(row.isCompleted),
      enrolledAt: row.enrolledAt,
      cpeCredits: Number(row.cpeCredits ?? 0),
      certificateCode: row.certificateCode ?? null,
    }));

    const completedCourses = enrollments.filter((enrollment) => enrollment.isCompleted).length;
    const averageWatchPercent = enrollments.length > 0
      ? Number((enrollments.reduce((sum, enrollment) => sum + enrollment.watchPercent, 0) / enrollments.length).toFixed(2))
      : 0;

    const orderMap = new Map<
      number,
      {
        id: string;
        amount: number;
        status: string;
        createdAt: Date | string | null;
        courseTitles: string[];
      }
    >();

    for (const row of orderRows) {
      const orderId = Number(row.orderId);
      const existing = orderMap.get(orderId);
      if (existing) {
        if (row.courseTitle && !existing.courseTitles.includes(row.courseTitle)) {
          existing.courseTitles.push(row.courseTitle);
        }
        continue;
      }

      orderMap.set(orderId, {
        id: String(orderId),
        amount: Number(row.amount ?? 0),
        status: String(row.status),
        createdAt: row.createdAt,
        courseTitles: row.courseTitle ? [row.courseTitle] : [],
      });
    }

    const transactions = Array.from(orderMap.values()).slice(0, 10);
    const certificates = certificateRows.map((row) => ({
      id: String(row.id),
      certificateCode: row.certificateCode,
      issuedAt: row.issuedAt,
      courseId: String(row.courseId),
      courseTitle: row.courseTitle,
      cpeCredits: Number(row.cpeCredits ?? 0),
    }));

    const earnedCpeCredits = certificates.reduce((sum, certificate) => sum + certificate.cpeCredits, 0);
    const accountStatus = (user.failedAttempts ?? 0) >= 5 ? 'inactive' : 'active';

    return {
      profile: {
        id: String(user.id),
        fullName: user.fullName || 'ไม่ระบุชื่อ',
        email: user.email,
        role: user.role,
        professionalLicenseNumber: user.professionalLicenseNumber ?? null,
        createdAt: user.createdAt,
        accountStatus,
        failedAttempts: Number(user.failedAttempts ?? 0),
      },
      summary: {
        totalCourses: enrollments.length,
        completedCourses,
        inProgressCourses: Math.max(enrollments.length - completedCourses, 0),
        averageWatchPercent,
        totalSpent,
        earnedCpeCredits,
      },
      enrollments,
      transactions,
      certificates,
    };
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
      professionalLicenseNumber: input.professionalLicenseNumber,
    });
  },

  async updateUser(id: number, input: UpdateUserInput) {
    const user = await userRepository.update(id, {
      fullName: input.fullName,
      email: input.email,
      professionalLicenseNumber: input.professionalLicenseNumber,
    });
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
