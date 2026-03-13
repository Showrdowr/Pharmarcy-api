import { db } from './src/db/index.js';
import { roles } from './src/db/schema/index.js';
import { eq } from 'drizzle-orm';

async function renameRoles() {
  try {
    console.log('Renaming roles...');
    
    // Rename 'admin' to 'super_admin'
    await db.update(roles)
      .set({ name: 'super_admin', description: 'ผู้ดูแลระบบ (สิทธิ์สูงสุด) — สามารถจัดการได้ทุกระบบ รวมถึงผู้ใช้งานและการเงิน' })
      .where(eq(roles.name, 'admin'));
    console.log('✅ Renamed admin -> super_admin');

    // Rename 'officer' to 'system_admin'
    await db.update(roles)
      .set({ name: 'system_admin', description: 'เจ้าหน้าที่ (System Admin) — จัดการเฉพาะระบบคอร์สเรียน' })
      .where(eq(roles.name, 'officer'));
    console.log('✅ Renamed officer -> system_admin');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error renaming roles:', err);
    process.exit(1);
  }
}

renameRoles();
