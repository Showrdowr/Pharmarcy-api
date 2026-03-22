import { eq, sql, and, count, ilike, or, desc, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, NewUser, User } from '../../db/schema/users.js';
import { certificates, enrollments } from '../../db/schema/progress.js';
import { courses } from '../../db/schema/courses.js';
import { orderItems, orders } from '../../db/schema/orders.js';

export const userRepository = {
  async findAll(): Promise<User[]> {
    return db.select().from(users);
  },

  async findAllWithFilters(filters: { role?: 'member' | 'pharmacist' | 'admin'; limit?: number; offset?: number; search?: string; status?: 'active' | 'inactive' }) {
    const query = db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        professionalLicenseNumber: users.professionalLicenseNumber,
        createdAt: users.createdAt,
        failedAttempts: users.failedAttempts,
        courseCount: count(enrollments.id),
      })
      .from(users)
      .leftJoin(enrollments, eq(users.id, enrollments.userId))
      .groupBy(users.id);

    const whereConditions = [];
    if (filters.role) {
      whereConditions.push(eq(users.role, filters.role));
    }
    if (filters.search) {
      whereConditions.push(
        or(
          ilike(users.fullName, `%${filters.search}%`),
          ilike(users.email, `%${filters.search}%`),
          ilike(users.professionalLicenseNumber, `%${filters.search}%`)
        )
      );
    }

    if (filters.status) {
      if (filters.status === 'active') {
        whereConditions.push(sql`${users.failedAttempts} < 5`);
      } else {
        whereConditions.push(sql`${users.failedAttempts} >= 5`);
      }
    }

    if (whereConditions.length > 0) {
      query.where(and(...whereConditions));
    }

    if (filters.limit !== undefined) {
      query.limit(filters.limit);
    }

    if (filters.offset !== undefined) {
      query.offset(filters.offset);
    }

    return query.orderBy(sql`${users.createdAt} DESC`);
  },

  async getStats(role?: 'member' | 'pharmacist' | 'admin', search?: string, status?: 'active' | 'inactive') {
    const query = db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${users.failedAttempts} < 5)`,
        inactive: sql<number>`count(*) filter (where ${users.failedAttempts} >= 5)`,
      })
      .from(users);
    
    const whereConditions = [];
    if (role) {
      whereConditions.push(eq(users.role, role));
    }
    if (search) {
      whereConditions.push(
        or(
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.professionalLicenseNumber, `%${search}%`)
        )
      );
    }

    if (status) {
      if (status === 'active') {
        whereConditions.push(sql`${users.failedAttempts} < 5`);
      } else {
        whereConditions.push(sql`${users.failedAttempts} >= 5`);
      }
    }

    if (whereConditions.length > 0) {
      query.where(and(...whereConditions));
    }

    const [stats] = await query;
    return stats;
  },

  async getEarnedCpeCreditsByUserIds(userIds: number[]) {
    if (userIds.length === 0) {
      return new Map<number, number>();
    }

    const creditRows = await db
      .select({
        userId: certificates.userId,
        totalCredits: sql<string>`coalesce(sum(${courses.cpeCredits}), 0)`,
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(inArray(certificates.userId, userIds))
      .groupBy(certificates.userId);

    return new Map(
      creditRows.map((row) => [Number(row.userId), Number(row.totalCredits ?? 0)])
    );
  },

  async getRoleCpeSummary(role: 'pharmacist') {
    const [summary] = await db
      .select({
        totalCredits: sql<string>`coalesce(sum(${courses.cpeCredits}), 0)`,
      })
      .from(users)
      .leftJoin(certificates, eq(certificates.userId, users.id))
      .leftJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(users.role, role));

    return {
      totalCredits: Number(summary?.totalCredits ?? 0),
    };
  },

  async findById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async listEnrollmentsByUserId(userId: number) {
    return await db
      .select({
        enrollmentId: enrollments.id,
        courseId: courses.id,
        courseTitle: courses.title,
        enrolledAt: enrollments.enrolledAt,
        watchPercent: enrollments.watchPercent,
        completionPercent: enrollments.progressPercent,
        isCompleted: enrollments.isCompleted,
        cpeCredits: courses.cpeCredits,
        certificateCode: certificates.certificateCode,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(
        certificates,
        and(eq(certificates.userId, userId), eq(certificates.courseId, courses.id))
      )
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt));
  },

  async listOrderHistoryByUserId(userId: number) {
    return await db
      .select({
        orderId: orders.id,
        createdAt: orders.createdAt,
        amount: orders.grandTotal,
        status: orders.status,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .leftJoin(courses, eq(orderItems.courseId, courses.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt), desc(orders.id));
  },

  async listCertificatesByUserId(userId: number) {
    return await db
      .select({
        id: certificates.id,
        certificateCode: certificates.certificateCode,
        issuedAt: certificates.issuedAt,
        courseId: courses.id,
        courseTitle: courses.title,
        cpeCredits: courses.cpeCredits,
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));
  },

  async getTotalSpentByUserId(userId: number) {
    const [result] = await db
      .select({
        totalSpent: sql<string>`coalesce(sum(${orders.grandTotal}), 0)`,
      })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.status, 'PAID')));

    return Number(result?.totalSpent ?? 0);
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async findByFullName(fullName: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.fullName, fullName));
    return user;
  },

  async create(data: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async update(id: number, data: Partial<NewUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.count ?? 0) > 0;
  },

  async updateResetOtp(email: string, otp: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({ resetOtp: otp, resetOtpExpiresAt: expiresAt })
      .where(eq(users.email, email));
  },

  async clearResetOtp(email: string): Promise<void> {
    await db
      .update(users)
      .set({ resetOtp: null, resetOtpExpiresAt: null })
      .where(eq(users.email, email));
  },

  async incrementFailedAttempts(id: number) {
    await db
      .update(users)
      .set({
        failedAttempts: sql`${users.failedAttempts} + 1`,
        lastFailedAt: new Date(),
      })
      .where(eq(users.id, id));
  },

  async resetFailedAttempts(id: number) {
    await db
      .update(users)
      .set({
        failedAttempts: 0,
        lastFailedAt: null,
      })
      .where(eq(users.id, id));
  },
};
