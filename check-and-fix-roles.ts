import { db } from './src/db/index.js';
import { roles } from './src/db/schema/index.js';

async function checkAndFixRoles() {
  try {
    console.log('Checking roles in database...');
    const allRoles = await db.select().from(roles);
    console.log('Current roles:', allRoles);

    if (allRoles.length === 0) {
      console.log('No roles found. Seeding default roles...');
      const adminId = crypto.randomUUID();
      const officerId = crypto.randomUUID();
      
      await db.insert(roles).values([
        { 
          id: adminId, 
          name: 'super_admin', 
          description: 'ผู้ดูแลระบบ (สิทธิ์สูงสุด) — สามารถจัดการได้ทุกอย่าง รวมถึงอนุมัติเนื้อหาและสร้าง account' 
        },
        { 
          id: officerId, 
          name: 'system_admin', 
          description: 'เจ้าหน้าที่ (System Admin) — จัดการระบบการเรียน (คอร์ส, วิดีโอ, เอกสาร, ข้อสอบ)' 
        }
      ]);
      console.log('✅ Seeded super_admin and system_admin');
    } else {
      // Check if they need renaming from old names
      for (const role of allRoles) {
        if (role.name === 'admin') {
          await db.update(roles).set({ name: 'super_admin' }).where(eq(roles.id, role.id));
          console.log(`✅ Renamed role ${role.id} from admin to super_admin`);
        } else if (role.name === 'officer') {
          await db.update(roles).set({ name: 'system_admin' }).where(eq(roles.id, role.id));
          console.log(`✅ Renamed role ${role.id} from officer to system_admin`);
        }
      }
    }
    
    const finalRoles = await db.select().from(roles);
    console.log('Final roles:', finalRoles);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

// Helper for eq since we can't import it easily in a one-off script without setup
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

checkAndFixRoles();
