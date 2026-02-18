import { pgTable, uuid, varchar, text, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================
// Admin User table
// =============================================
export const adminUser = pgTable('admin_user', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createAt: timestamp('create_at').defaultNow(),
  updateAt: timestamp('update_at').defaultNow(),
});

// =============================================
// Roles table
// =============================================
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  createAt: timestamp('create_at').defaultNow(),
});

// =============================================
// Permissions table
// =============================================
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  description: text('description'),
  createAt: timestamp('create_at').defaultNow(),
});

// =============================================
// Junction: admin_user_roles (admin_id + role_id)
// =============================================
export const adminUserRoles = pgTable('admin_user_roles', {
  adminId: uuid('admin_id').notNull().references(() => adminUser.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.adminId, table.roleId] }),
]);

// =============================================
// Junction: role_permissions (role_id + permission_id)
// =============================================
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);

// =============================================
// Admin Audit Logs table
// =============================================
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').primaryKey(),
  adminId: uuid('admin_id').notNull().references(() => adminUser.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  targetTable: varchar('target_table', { length: 100 }),
  targetId: uuid('target_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 100 }),
  createAt: timestamp('create_at').defaultNow(),
});

// =============================================
// Relations
// =============================================
export const adminUserRelations = relations(adminUser, ({ many }) => ({
  roles: many(adminUserRoles),
  auditLogs: many(adminAuditLogs),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  adminUsers: many(adminUserRoles),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const adminUserRolesRelations = relations(adminUserRoles, ({ one }) => ({
  admin: one(adminUser, {
    fields: [adminUserRoles.adminId],
    references: [adminUser.id],
  }),
  role: one(roles, {
    fields: [adminUserRoles.roleId],
    references: [roles.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(adminUser, {
    fields: [adminAuditLogs.adminId],
    references: [adminUser.id],
  }),
}));

// =============================================
// Type exports
// =============================================
export type AdminUser = typeof adminUser.$inferSelect;
export type NewAdminUser = typeof adminUser.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
