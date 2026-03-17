import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as schema from './schema/index.js';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. Admin Roles
  // ============================================
  const superAdminRoleId = randomUUID();
  const officerRoleId = randomUUID();

  await db.insert(schema.roles).values([
    { id: superAdminRoleId, name: 'super_admin', description: 'ผู้ดูแลระบบสูงสุด' },
    { id: officerRoleId, name: 'officer', description: 'เจ้าหน้าที่' },
  ]).onConflictDoNothing();
  console.log('✅ Admin roles created');

  // ============================================
  // 2. Admin User (for backoffice login)
  // ============================================
  const adminId = randomUUID();
  const adminPasswordHash = await bcrypt.hash('Admin@1234', 10);

  await db.insert(schema.adminUser).values({
    id: adminId,
    username: 'admin',
    email: 'admin@pharmacy.ac.th',
    passwordHash: adminPasswordHash,
    department: 'IT',
    major: 'System Admin',
  }).onConflictDoNothing();

  await db.insert(schema.adminUserRoles).values({
    adminId: adminId,
    roleId: superAdminRoleId,
  }).onConflictDoNothing();
  console.log('✅ Admin user created: admin@pharmacy.ac.th / Admin@1234');

  // ============================================
  // 3. Frontend Users (member + pharmacist)
  // ============================================
  const memberHash = await bcrypt.hash('User@1234', 10);
  const pharmacistHash = await bcrypt.hash('Pharma@1234', 10);

  await db.insert(schema.users).values([
    {
      fullName: 'สมชาย ใจดี',
      email: 'user@test.com',
      passwordHash: memberHash,
      role: 'member',
    },
    {
      fullName: 'ดร.ภก. วิชัย เภสัชกร',
      email: 'pharmacist@test.com',
      passwordHash: pharmacistHash,
      role: 'pharmacist',
      professionalLicenseNumber: 'PH-12345',
    },
  ]).onConflictDoNothing();
  console.log('✅ Frontend users created:');
  console.log('   - user@test.com / User@1234 (member)');
  console.log('   - pharmacist@test.com / Pharma@1234 (pharmacist)');

  // ============================================
  // 4. Categories
  // ============================================
  const [cat1] = await db.insert(schema.categories).values([
    { name: 'เภสัชวิทยา', description: 'Pharmacology - การศึกษาเกี่ยวกับยาและผลของยาต่อร่างกาย', color: '#3B82F6' },
    { name: 'เภสัชกรรมคลินิก', description: 'Clinical Pharmacy - การดูแลผู้ป่วยโดยเภสัชกร', color: '#10B981' },
    { name: 'เคมีเภสัช', description: 'Pharmaceutical Chemistry - เคมีที่เกี่ยวข้องกับยา', color: '#F59E0B' },
    { name: 'เภสัชเวท', description: 'Pharmacognosy - การศึกษาสมุนไพรและผลิตภัณฑ์ธรรมชาติ', color: '#8B5CF6' },
    { name: 'เทคโนโลยีเภสัชกรรม', description: 'Pharmaceutical Technology - การผลิตและพัฒนาเภสัชภัณฑ์', color: '#EF4444' },
    { name: 'กฎหมายเภสัชกรรม', description: 'Pharmacy Law - กฎหมายและจริยธรรมทางเภสัชกรรม', color: '#6366F1' },
  ]).returning();
  console.log('✅ 6 categories created');

  // ============================================
  // 5. Sample Courses
  // ============================================
  const categoryIds = await db.select({ id: schema.categories.id }).from(schema.categories);

  await db.insert(schema.courses).values([
    {
      categoryId: categoryIds[0]?.id,
      title: 'หลักการเภสัชวิทยาเบื้องต้น',
      description: 'เรียนรู้พื้นฐานเภสัชวิทยา กลไกการออกฤทธิ์ของยา เภสัชจลนศาสตร์ และเภสัชพลศาสตร์ เหมาะสำหรับเภสัชกรและบุคลากรทางการแพทย์',
      authorName: 'ดร.ภก. สมศักดิ์ ยาดี',
      price: '1500.00',
      cpeCredits: 10,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[1]?.id,
      title: 'การดูแลผู้ป่วยเบาหวานสำหรับเภสัชกร',
      description: 'แนวทางการดูแลผู้ป่วยเบาหวานอย่างครบวงจร การปรับยา การให้คำแนะนำ และการติดตามผล พร้อมกรณีศึกษาจริง',
      authorName: 'ภก.หญิง นิภา ใจดี',
      price: '2500.00',
      cpeCredits: 15,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[2]?.id,
      title: 'เคมีเภสัชขั้นสูง: การวิเคราะห์โครงสร้างยา',
      description: 'เรียนรู้ความสัมพันธ์ระหว่างโครงสร้างเคมีกับฤทธิ์ทางชีวภาพ การออกแบบยาใหม่ และเทคนิคการวิเคราะห์',
      authorName: 'ศ.ดร. วิทยา เคมีดี',
      price: '3000.00',
      cpeCredits: 20,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[3]?.id,
      title: 'สมุนไพรไทยกับการแพทย์แผนปัจจุบัน',
      description: 'การนำสมุนไพรไทยมาประยุกต์ใช้ในทางเภสัชกรรม หลักฐานทางวิทยาศาสตร์ ข้อควรระวัง และอันตรกิริยากับยาแผนปัจจุบัน',
      authorName: 'ภก. ธนพล สมุนไพร',
      price: '1800.00',
      cpeCredits: 12,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[4]?.id,
      title: 'เทคโนโลยีนาโนในการนำส่งยา',
      description: 'นวัตกรรมระบบนำส่งยาด้วยอนุภาคนาโน ลิโปโซม และไมเซลล์ การประยุกต์ใช้ในทางคลินิก',
      authorName: 'รศ.ดร. กมล นาโน',
      price: '3500.00',
      cpeCredits: 18,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[5]?.id,
      title: 'กฎหมายเภสัชกรรม พ.ร.บ.ยา พ.ศ.2510 ฉบับอัปเดต',
      description: 'เรียนรู้กฎหมายที่เกี่ยวข้องกับวิชาชีพเภสัชกรรม พ.ร.บ.ยา กฎกระทรวง และแนวปฏิบัติล่าสุด',
      authorName: 'ภก. กฤษณ์ กฎหมาย',
      price: '1200.00',
      cpeCredits: 8,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    {
      categoryId: categoryIds[0]?.id,
      title: 'ยาปฏิชีวนะ: หลักการใช้และการดื้อยา',
      description: 'ทำความเข้าใจกลไกการออกฤทธิ์ของยาปฏิชีวนะ ปัญหาเชื้อดื้อยา และแนวทาง Antimicrobial Stewardship',
      authorName: 'ดร.ภก. สมศักดิ์ ยาดี',
      price: '2000.00',
      cpeCredits: 12,
      status: 'DRAFT',
    },
  ]);
  console.log('✅ 7 sample courses created (6 published, 1 draft)');

  // ============================================
  // Done
  // ============================================
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ Backoffice:  admin@pharmacy.ac.th / Admin@1234  │');
  console.log('│ Frontend:    user@test.com / User@1234          │');
  console.log('│ Pharmacist:  pharmacist@test.com / Pharma@1234  │');
  console.log('└─────────────────────────────────────────────────┘');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
