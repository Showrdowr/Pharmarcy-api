import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function fix() {
  // 1. ดูข้อมูลปัจจุบัน
  const admins = await sql`SELECT id, username, email FROM admin_user`;
  console.log('=== admin_user ===');
  admins.forEach(a => console.log(`  id: ${a.id} | ${a.username} | ${a.email}`));

  const userRoles = await sql`SELECT admin_id, role_id FROM admin_user_roles`;
  console.log('\n=== admin_user_roles ===');
  userRoles.forEach(r => console.log(`  admin_id: ${r.admin_id} | role_id: ${r.role_id}`));

  const roles = await sql`SELECT id, name FROM admin_roles`;
  console.log('\n=== admin_roles ===');
  roles.forEach(r => console.log(`  id: ${r.id} | ${r.name}`));

  // 2. แก้ไข: ลบ role เก่าทั้งหมด แล้วมอบ admin role ให้ admin@pharmacy.ac.th ใหม่
  const adminUser = admins.find(a => a.email === 'admin@pharmacy.ac.th');
  const adminRole = roles.find(r => r.name === 'admin');

  if (adminUser && adminRole) {
    await sql`DELETE FROM admin_user_roles WHERE admin_id != ${adminUser.id}`;
    await sql`DELETE FROM admin_user_roles WHERE admin_id = ${adminUser.id}`;
    await sql`INSERT INTO admin_user_roles (admin_id, role_id) VALUES (${adminUser.id}, ${adminRole.id})`;
    console.log(`\n✅ มอบ role "admin" ให้ ${adminUser.email} (id: ${adminUser.id}) เรียบร้อย!`);
  }

  // 3. ยืนยันผลลัพธ์
  const result = await sql`
    SELECT au.id, au.email, r.name as role_name
    FROM admin_user au
    JOIN admin_user_roles aur ON au.id = aur.admin_id
    JOIN admin_roles r ON aur.role_id = r.id
  `;
  console.log('\n=== ผลลัพธ์สุดท้าย ===');
  result.forEach(r => console.log(`  ${r.email} → role: ${r.role_name} (id: ${r.id})`));

  await sql.end();
}

fix().catch(err => { console.error(err); process.exit(1); });
