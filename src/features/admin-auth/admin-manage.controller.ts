import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { adminUser, adminUserRoles, roles } from '../../db/schema/index.js';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { CreateOfficerInput, AdminUserParams, DeleteAdminBody } from './admin-manage.schema.js';
import { adminAuthRepository } from './admin-auth.repository.js';
import { auditLogsService } from '../audit-logs/audit-logs.service.js';

export const adminManageController = {
  /**
   * สร้าง officer account (เฉพาะ admin) — ต้องยืนยันรหัสผ่าน
   */
  async createOfficer(
    request: FastifyRequest<{ Body: CreateOfficerInput }>,
    reply: FastifyReply
  ) {
    const { email, password, role, department, major, confirmPassword } = request.body;
    const currentUser = request.user as { id: string };

    // 1. Verify admin's password
    const admin = await db
      .select({ id: adminUser.id, passwordHash: adminUser.passwordHash })
      .from(adminUser)
      .where(eq(adminUser.id, currentUser.id))
      .limit(1);

    if (admin.length === 0) {
      return reply.status(401).send({ success: false, code: 'UNAUTHORIZED', error: 'ไม่พบข้อมูลผู้ดูแลระบบ', message: 'ไม่พบข้อมูลผู้ดูแลระบบ' });
    }

    const isPasswordValid = await bcrypt.compare(confirmPassword, admin[0].passwordHash);
    if (!isPasswordValid) {
      return reply.status(403).send({ success: false, code: 'INVALID_CONFIRM_PASSWORD', error: 'รหัสผ่านยืนยันไม่ถูกต้อง', message: 'รหัสผ่านยืนยันไม่ถูกต้อง' });
    }

    // 2. Check duplicate email
    const existingEmail = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return reply.status(409).send({ success: false, code: 'ADMIN_EMAIL_EXISTS', error: 'อีเมลนี้มีอยู่ในระบบแล้ว', message: 'อีเมลนี้มีอยู่ในระบบแล้ว' });
    }

    // 3. Generate username based on role
    let username = email.split('@')[0];
    
    if ((role === 'officer' || role === 'system_admin') && (major || department)) {
      const sameGroupAdmins = await db
        .select({ id: adminUser.id })
        .from(adminUser)
        .where(
          major
            ? eq(adminUser.major, major)
            : eq(adminUser.department, department!)
        );
      
      const count = sameGroupAdmins.length + 1;
      const seq = String(count).padStart(2, '0');
      
      const parts = [major, department, seq].filter(Boolean);
      username = parts.join('/');
    }

    // Check duplicate username
    let existingUsername = await db
      .select({ id: adminUser.id })
      .from(adminUser)
      .where(eq(adminUser.username, username))
      .limit(1);

    let counter = 1;
    let finalUsername = username;
    while (existingUsername.length > 0) {
      finalUsername = `${username}${counter}`;
      existingUsername = await db
        .select({ id: adminUser.id })
        .from(adminUser)
        .where(eq(adminUser.username, finalUsername))
        .limit(1);
      counter++;
    }

    // 4. Hash password + create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await db.insert(adminUser).values({
      id: userId,
      username: finalUsername,
      email,
      passwordHash,
      department: department || null,
      major: major || null,
    });

    // Get assigned role id
    const assignedRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, role))
      .limit(1);

    if (assignedRole.length > 0) {
      await db.insert(adminUserRoles).values({
        adminId: userId,
        roleId: assignedRole[0].id,
      });
    }

    // Calculate major sequence if major is provided
    let majorSequence = null;
    if (major) {
      majorSequence = await adminAuthRepository.getMajorSequence(userId, major);
    }

    // 5. Record audit log
    void auditLogsService.recordAction({
      adminId: currentUser.id,
      action: 'CREATE_ADMIN',
      targetTable: 'admin_user',
      targetId: userId,
      newValue: { username: finalUsername, email, role, department, major },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: {
          id: userId,
          username: finalUsername,
          email,
          role,
          department,
          major,
          majorSequence,
        }
      }
    });
  },

  /**
   * ดึงรายชื่อ Roles ทั้งหมด
   */
  async listRoles(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
      })
      .from(roles);

    return reply.send({ success: true, data: { roles: allRoles } });
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
        department: adminUser.department,
        major: adminUser.major,
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
      department: r.department,
      major: r.major,
      role: r.roleName || 'officer',
      createAt: r.createAt,
    }));

    return reply.send({ success: true, data: { users } });
  },

  /**
   * ลบ admin/officer account (เฉพาะ admin, ลบตัวเองไม่ได้) — ต้องยืนยันรหัสผ่าน
   */
  async deleteAdminUser(
    request: FastifyRequest<{ Params: AdminUserParams; Body: DeleteAdminBody }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { confirmPassword } = request.body;
    const currentUser = request.user as { id: string };

    if (id === currentUser.id) {
      return reply.status(400).send({ success: false, code: 'ADMIN_SELF_DELETE_FORBIDDEN', error: 'ไม่สามารถลบ account ของตัวเองได้', message: 'ไม่สามารถลบ account ของตัวเองได้' });
    }

    // 1. Verify admin's password
    const admin = await db
      .select({ id: adminUser.id, passwordHash: adminUser.passwordHash })
      .from(adminUser)
      .where(eq(adminUser.id, currentUser.id))
      .limit(1);

    if (admin.length === 0) {
      return reply.status(401).send({ success: false, code: 'UNAUTHORIZED', error: 'ไม่พบข้อมูลผู้ดูแลระบบ', message: 'ไม่พบข้อมูลผู้ดูแลระบบ' });
    }

    const isPasswordValid = await bcrypt.compare(confirmPassword, admin[0].passwordHash);
    if (!isPasswordValid) {
      return reply.status(403).send({ success: false, code: 'INVALID_CONFIRM_PASSWORD', error: 'รหัสผ่านยืนยันไม่ถูกต้อง', message: 'รหัสผ่านยืนยันไม่ถูกต้อง' });
    }

    // 2. Check if target user exists and get their info for audit log
    const existing = await db
      .select({
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        department: adminUser.department,
        major: adminUser.major,
      })
      .from(adminUser)
      .where(eq(adminUser.id, id))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ success: false, code: 'ADMIN_USER_NOT_FOUND', error: 'ไม่พบผู้ใช้นี้', message: 'ไม่พบผู้ใช้นี้' });
    }

    const deletedUser = existing[0];

    // 3. Delete user
    await db.delete(adminUser).where(eq(adminUser.id, id));

    // 4. Record audit log
    void auditLogsService.recordAction({
      adminId: currentUser.id,
      action: 'DELETE_ADMIN',
      targetTable: 'admin_user',
      targetId: id,
      oldValue: { username: deletedUser.username, email: deletedUser.email, department: deletedUser.department, major: deletedUser.major },
      ipAddress: request.ip,
    });

    return reply.send({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
  },

};
