import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { adminUser, adminUserRoles, roles } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { CreateOfficerInput, AdminUserParams } from './admin-manage.schema.js';

export const adminManageController = {
  /**
   * สร้าง officer account (เฉพาะ admin)
   */
  async createOfficer(
    request: FastifyRequest<{ Body: CreateOfficerInput }>,
    reply: FastifyReply
  ) {
    const { username, email, password } = request.body;

    // Check duplicate email
    const existingEmail = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return reply.status(409).send({ success: false, error: 'อีเมลนี้มีอยู่ในระบบแล้ว' });
    }

    // Check duplicate username
    const existingUsername = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return reply.status(409).send({ success: false, error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' });
    }

    // Hash password + create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.insert(adminUser).values({
      id: userId,
      username,
      email,
      passwordHash,
    });

    // Get officer role id
    const officerRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'officer'))
      .limit(1);

    if (officerRole.length > 0) {
      await db.insert(adminUserRoles).values({
        adminId: userId,
        roleId: officerRole[0].id,
      });
    }

    return reply.status(201).send({
      success: true,
      user: {
        id: userId,
        username,
        email,
        role: 'officer',
      },
    });
  },

  /**
   * List admin/officer accounts ทั้งหมด
   */
  async listAdminUsers(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const result = await db
      .select({
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        createAt: adminUser.createAt,
        roleName: roles.name,
      })
      .from(adminUser)
      .leftJoin(adminUserRoles, eq(adminUser.id, adminUserRoles.adminId))
      .leftJoin(roles, eq(adminUserRoles.roleId, roles.id))
      .orderBy(adminUser.createAt);

    const users = result.map(r => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.roleName || 'officer',
      createAt: r.createAt,
    }));

    return reply.send({ success: true, users });
  },

  /**
   * ลบ admin/officer account (เฉพาะ admin, ลบตัวเองไม่ได้)
   */
  async deleteAdminUser(
    request: FastifyRequest<{ Params: AdminUserParams }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const currentUser = request.user as { id: string };

    if (id === currentUser.id) {
      return reply.status(400).send({ success: false, error: 'ไม่สามารถลบ account ของตัวเองได้' });
    }

    // Check if user exists
    const existing = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.id, id))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, error: 'ไม่พบผู้ใช้นี้' });
    }

    await db.delete(adminUser).where(eq(adminUser.id, id));

    return reply.send({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
  },
};
