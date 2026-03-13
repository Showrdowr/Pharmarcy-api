import { db } from './src/db/index.js';
import { roles, adminUserRoles, adminUser } from './src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function updateAdmin() {
  try {
    // Check if super_admin role exists
    let superAdminRoleRow = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'super_admin'))
      .limit(1);

    if (superAdminRoleRow.length === 0) {
      console.log('Creating super_admin role...');
      const newRole = await db.insert(roles).values({
        id: crypto.randomUUID(),
        name: 'super_admin',
        description: 'Super Administrator with full access'
      }).returning({ id: roles.id });
      superAdminRoleRow = newRole;
    }

    const superAdminRoleId = superAdminRoleRow[0].id;

    // Optional: create system_admin role as well
    const systemAdminRoleRow = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, 'system_admin'))
      .limit(1);

    if (systemAdminRoleRow.length === 0) {
      console.log('Creating system_admin role...');
      await db.insert(roles).values({
        id: crypto.randomUUID(),
        name: 'system_admin',
        description: 'System Administrator with limited access'
      });
    }

    // Get the current admin
    const adminRows = await db.select().from(adminUser);
    for (const admin of adminRows) {
      console.log(`Updating role for admin: ${admin.username} (${admin.email})`);
      
      // Delete existing roles for this admin
      await db.delete(adminUserRoles).where(eq(adminUserRoles.adminId, admin.id));
      
      // Assign super_admin role
      await db.insert(adminUserRoles).values({
        adminId: admin.id,
        roleId: superAdminRoleId,
      });
      console.log(`Set ${admin.username} to super_admin successfully.`);
    }

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating admin:', error);
    process.exit(1);
  }
}

updateAdmin();
