import { db } from '../../db/index.js';
import { adminAuditLogs, adminUser } from '../../db/schema/index.js';
import { eq, desc, and, gte, lte, sql, ilike, or } from 'drizzle-orm';
import type { ListAuditLogsQuery, CreateAuditLogInput } from './audit-logs.schema.js';
import crypto from 'crypto';

export const auditLogsRepository = {
  async listLogs(query: ListAuditLogsQuery) {
    const { page = 1, limit = 10, adminId, action, targetTable, startDate, endDate, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (adminId) {
      conditions.push(eq(adminAuditLogs.adminId, adminId));
    }
    if (action) {
      conditions.push(eq(adminAuditLogs.action, action));
    }
    if (targetTable) {
      conditions.push(eq(adminAuditLogs.targetTable, targetTable));
    }
    if (startDate) {
      conditions.push(gte(adminAuditLogs.createAt, `${startDate} 00:00:00`));
    }
    if (endDate) {
      conditions.push(lte(adminAuditLogs.createAt, `${endDate} 23:59:59`));
    }
    if (search) {
      const orConditions = [
        ilike(adminAuditLogs.action, `%${search}%`),
        ilike(adminAuditLogs.targetTable, `%${search}%`),
        ilike(adminUser.username, `%${search}%`),
        ilike(adminAuditLogs.ipAddress, `%${search}%`),
        // Targeted JSONB search for name/title to avoid accidental matches
        sql`${adminAuditLogs.newValue}->>'name' ILIKE ${`%${search}%`}`,
        sql`${adminAuditLogs.newValue}->>'title' ILIKE ${`%${search}%`}`,
        sql`${adminAuditLogs.oldValue}->>'name' ILIKE ${`%${search}%`}`,
        sql`${adminAuditLogs.oldValue}->>'title' ILIKE ${`%${search}%`}`,
      ];

      // Precise Mapping for full phrases
      if (search.includes('ลบหมวดหมู่ย่อย')) {
        orConditions.push(ilike(adminAuditLogs.action, '%DELETE_SUBCATEGORY%'));
      } else if (search.includes('สร้างหมวดหมู่ย่อย')) {
        orConditions.push(ilike(adminAuditLogs.action, '%CREATE_SUBCATEGORY%'));
      } else if (search.includes('แก้ไขหมวดหมู่ย่อย')) {
        orConditions.push(ilike(adminAuditLogs.action, '%UPDATE_SUBCATEGORY%'));
      } else if (search.includes('ลบหมวดหมู่')) {
        orConditions.push(ilike(adminAuditLogs.action, '%DELETE_CATEGORY%'));
      } else if (search.includes('สร้างหมวดหมู่')) {
        orConditions.push(ilike(adminAuditLogs.action, '%CREATE_CATEGORY%'));
      } else if (search.includes('แก้ไขหมวดหมู่')) {
        orConditions.push(ilike(adminAuditLogs.action, '%UPDATE_CATEGORY%'));
      } else if (search.includes('ลบคอร์ส')) {
        orConditions.push(ilike(adminAuditLogs.action, '%DELETE_COURSE%'));
      } else if (search.includes('สร้างคอร์ส')) {
        orConditions.push(ilike(adminAuditLogs.action, '%CREATE_COURSE%'));
      } else if (search.includes('แก้ไขคอร์ส')) {
        orConditions.push(ilike(adminAuditLogs.action, '%UPDATE_COURSE%'));
      } else {
        // Fallback to individual keyword mapping (with strict separation for category/subcategory)
        if (search.includes('ลบ')) orConditions.push(ilike(adminAuditLogs.action, '%DELETE%'));
        if (search.includes('สร้าง')) orConditions.push(ilike(adminAuditLogs.action, '%CREATE%'));
        if (search.includes('แก้ไข')) orConditions.push(ilike(adminAuditLogs.action, '%UPDATE%'));
        
        if (search.includes('หมวดหมู่ย่อย')) {
          orConditions.push(eq(adminAuditLogs.targetTable, 'subcategories'));
        } else if (search.includes('หมวดหมู่')) {
          orConditions.push(eq(adminAuditLogs.targetTable, 'categories'));
        }
        
        if (search.includes('คอร์ส')) {
          orConditions.push(eq(adminAuditLogs.targetTable, 'courses'));
        }
      }

      conditions.push(or(...orConditions));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select({
        id: adminAuditLogs.id,
        adminId: adminAuditLogs.adminId,
        action: adminAuditLogs.action,
        targetTable: adminAuditLogs.targetTable,
        targetId: adminAuditLogs.targetId,
        oldValue: adminAuditLogs.oldValue,
        newValue: adminAuditLogs.newValue,
        ipAddress: adminAuditLogs.ipAddress,
        createAt: adminAuditLogs.createAt,
        admin: {
          username: adminUser.username,
          email: adminUser.email,
        },
      })
      .from(adminAuditLogs)
      .leftJoin(adminUser, eq(adminAuditLogs.adminId, adminUser.id))
      .where(where)
      .orderBy(desc(adminAuditLogs.createAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminAuditLogs)
      .leftJoin(adminUser, eq(adminAuditLogs.adminId, adminUser.id))
      .where(where);

    return {
      data: logs,
      total: totalResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult?.count || 0) / limit),
    };
  },

  async createLog(data: CreateAuditLogInput) {
    // Attempt to handle UUID conversion for targetId if applicable
    let targetId: string | null = null;
    if (data.targetId) {
      // Very loose check to see if it's a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(data.targetId)) {
        targetId = data.targetId;
      }
    }

    const [result] = await db.insert(adminAuditLogs).values({
      id: crypto.randomUUID(),
      adminId: data.adminId,
      action: data.action,
      targetTable: data.targetTable,
      targetId: targetId, // This is a bit risky if schema expects UUID and we give null/wrong string, but schema says UUID
      oldValue: data.oldValue,
      newValue: data.newValue,
      ipAddress: data.ipAddress,
    }).returning();
    
    return result;
  }
};

