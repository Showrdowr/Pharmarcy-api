import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, NewUser, User } from '../../db/schema/users.js';

export const userRepository = {
  async findAll(): Promise<User[]> {
    return db.select().from(users);
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
