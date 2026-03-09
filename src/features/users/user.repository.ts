import { eq, sql, and, count, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, NewUser, User } from '../../db/schema/users.js';
import { enrollments } from '../../db/schema/progress.js';

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

  async findById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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
