/**
 * Seed script: สร้าง roles (admin, officer) และ default admin account
 * 
 * Usage: npx tsx seed-roles.ts
 */
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString);

async function seed() {
  console.log('🌱 Starting seed...\n');

  // =============================================
  // 1. Seed Roles
  // =============================================
  const adminRoleId = crypto.randomUUID();
  const officerRoleId = crypto.randomUUID();

  // Check if roles already exist
  const existingRoles = await sql`SELECT name FROM roles`;
  const existingRoleNames = existingRoles.map(r => r.name);

  if (!existingRoleNames.includes('admin')) {
    await sql`
      INSERT INTO roles (id, name, description)
      VALUES (${adminRoleId}, 'admin', 'ผู้ดูแลระบบ — สามารถจัดการได้ทุกอย่าง รวมถึงอนุมัติเนื้อหาและสร้าง account')
    `;
    console.log('✅ Created role: admin');
  } else {
    console.log('⏭️  Role "admin" already exists, skipping');
  }

  if (!existingRoleNames.includes('officer')) {
    await sql`
      INSERT INTO roles (id, name, description)
      VALUES (${officerRoleId}, 'officer', 'เจ้าหน้าที่ — จัดการระบบการเรียน (คอร์ส, วิดีโอ, เอกสาร, ข้อสอบ) แต่ต้องรอ admin อนุมัติก่อน publish')
    `;
    console.log('✅ Created role: officer');
  } else {
    console.log('⏭️  Role "officer" already exists, skipping');
  }

  // =============================================
  // 2. Seed Default Admin User
  // =============================================
  const defaultAdminEmail = 'admin@pharmacy.ac.th';
  const defaultAdminUsername = 'admin';
  const defaultAdminPassword = 'admin1234';

  const existingAdmin = await sql`SELECT email FROM admin_user WHERE email = ${defaultAdminEmail}`;

  if (existingAdmin.length === 0) {
    const adminUserId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(defaultAdminPassword, 10);

    await sql`
      INSERT INTO admin_user (id, username, email, password_hash)
      VALUES (${adminUserId}, ${defaultAdminUsername}, ${defaultAdminEmail}, ${passwordHash})
    `;
    console.log(`✅ Created default admin user: ${defaultAdminEmail}`);

    // Assign admin role
    // Get the actual admin role id (might have been created in a previous run)
    const adminRole = await sql`SELECT id FROM roles WHERE name = 'admin'`;
    if (adminRole.length > 0) {
      await sql`
        INSERT INTO admin_user_roles (admin_id, role_id)
        VALUES (${adminUserId}, ${adminRole[0].id})
      `;
      console.log('✅ Assigned "admin" role to default admin user');
    }
  } else {
    console.log(`⏭️  Admin user "${defaultAdminEmail}" already exists, skipping`);
  }

  // =============================================
  // 3. Summary
  // =============================================
  console.log('\n📋 Current state:');

  const allRoles = await sql`SELECT id, name, description FROM roles ORDER BY name`;
  console.log('\nRoles:');
  allRoles.forEach(r => console.log(`  - ${r.name}: ${r.description}`));

  const allAdmins = await sql`
    SELECT au.id, au.username, au.email, r.name as role_name
    FROM admin_user au
    LEFT JOIN admin_user_roles aur ON au.id = aur.admin_id
    LEFT JOIN roles r ON aur.role_id = r.id
    ORDER BY au.username
  `;
  console.log('\nAdmin Users:');
  allAdmins.forEach(a => console.log(`  - ${a.username} (${a.email}) — role: ${a.role_name || 'none'}`));

  console.log('\n✨ Seed completed!');
  console.log('\n🔐 Default admin credentials:');
  console.log(`   Email:    ${defaultAdminEmail}`);
  console.log(`   Password: ${defaultAdminPassword}`);
  console.log('   ⚠️  กรุณาเปลี่ยนรหัสผ่านหลังจาก login ครั้งแรก!\n');

  await sql.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
