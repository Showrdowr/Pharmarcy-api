import { db } from '../../db/index.js';
import { adminUser, adminUserRoles, roles } from '../../db/schema/index.js';
import { eq, sql } from 'drizzle-orm';

export const adminAuthRepository = {
  /**
   * Find admin user by email, including their role
   */
  async findByEmail(email: string) {
    const result = await db
      .select({
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        passwordHash: adminUser.passwordHash,
        failedAttempts: adminUser.failedAttempts,
        lastFailedAt: adminUser.lastFailedAt,
        createAt: adminUser.createAt,
        updateAt: adminUser.updateAt,
        roleName: roles.name,
      })
      .from(adminUser)
      .leftJoin(adminUserRoles, eq(adminUser.id, adminUserRoles.adminId))
      .leftJoin(roles, eq(adminUserRoles.roleId, roles.id))
      .where(eq(adminUser.email, email))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      username: result[0].username,
      email: result[0].email,
      passwordHash: result[0].passwordHash,
      failedAttempts: result[0].failedAttempts || 0,
      lastFailedAt: result[0].lastFailedAt,
      role: result[0].roleName || 'officer',
      createAt: result[0].createAt,
      updateAt: result[0].updateAt,
    };
  },

  /**
   * Increment failed attempts for an admin user
   */
  async incrementFailedAttempts(id: string) {
    await db
      .update(adminUser)
      .set({
        failedAttempts: sql`${adminUser.failedAttempts} + 1`,
        lastFailedAt: new Date(),
      })
      .where(eq(adminUser.id, id));
  },

  /**
   * Reset failed attempts for an admin user
   */
  async resetFailedAttempts(id: string) {
    await db
      .update(adminUser)
      .set({
        failedAttempts: 0,
        lastFailedAt: null,
      })
      .where(eq(adminUser.id, id));
  },

  /**
   * Find admin user by ID, including their role
   */
  async findById(id: string) {
    const result = await db
      .select({
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        createAt: adminUser.createAt,
        updateAt: adminUser.updateAt,
        roleName: roles.name,
      })
      .from(adminUser)
      .leftJoin(adminUserRoles, eq(adminUser.id, adminUserRoles.adminId))
      .leftJoin(roles, eq(adminUserRoles.roleId, roles.id))
      .where(eq(adminUser.id, id))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id,
      username: result[0].username,
      email: result[0].email,
      role: result[0].roleName || 'officer',
      createAt: result[0].createAt,
      updateAt: result[0].updateAt,
    };
  },
};
