import { db } from '../../db/index.js';
import { adminUser, adminUserRoles, roles } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

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
      role: result[0].roleName || 'officer',
      createAt: result[0].createAt,
      updateAt: result[0].updateAt,
    };
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
