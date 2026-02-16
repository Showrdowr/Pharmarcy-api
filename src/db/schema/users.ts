import { pgTable, serial, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

// สร้าง enum ให้ตรงกับ DB
export const userRoleEnum = pgEnum('user_role', ['member', 'pharmacist', 'admin']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: varchar('full_name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('member'),
  professionalLicenseNumber: varchar('professional_license_number', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
