import { db } from '../../db/index.js';
import { adminLoginLogs, adminUser } from '../../db/schema/index.js';
import { eq, desc, and, gte, lte, sql, ilike, or } from 'drizzle-orm';
import type { ListLoginLogsQuery, CreateLoginLogInput } from './admin-login-logs.schema.js';
import crypto from 'crypto';

export const adminLoginLogsRepository = {
  async listLogs(query: ListLoginLogsQuery) {
    const { page = 1, limit = 10, adminId, status, startDate, endDate, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (adminId) {
      conditions.push(eq(adminLoginLogs.adminId, adminId));
    }
    if (status) {
      conditions.push(eq(adminLoginLogs.status, status));
    }
    if (startDate) {
      conditions.push(gte(adminLoginLogs.createAt, `${startDate} 00:00:00`));
    }
    if (endDate) {
      conditions.push(lte(adminLoginLogs.createAt, `${endDate} 23:59:59`));
    }
    if (search) {
      conditions.push(
        or(
          ilike(adminUser.username, `%${search}%`),
          ilike(adminLoginLogs.ipAddress, `%${search}%`),
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select({
        id: adminLoginLogs.id,
        adminId: adminLoginLogs.adminId,
        status: adminLoginLogs.status,
        ipAddress: adminLoginLogs.ipAddress,
        userAgent: adminLoginLogs.userAgent,
        createAt: adminLoginLogs.createAt,
        admin: {
          username: adminUser.username,
          email: adminUser.email,
        },
      })
      .from(adminLoginLogs)
      .leftJoin(adminUser, eq(adminLoginLogs.adminId, adminUser.id))
      .where(where)
      .orderBy(desc(adminLoginLogs.createAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminLoginLogs)
      .leftJoin(adminUser, eq(adminLoginLogs.adminId, adminUser.id))
      .where(where);

    return {
      data: logs,
      total: totalResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    };
  },

  async createLog(data: CreateLoginLogInput) {
    const [result] = await db.insert(adminLoginLogs).values({
      id: crypto.randomUUID(),
      adminId: data.adminId,
      status: data.status,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    }).returning();
    
    return result;
  }
};
