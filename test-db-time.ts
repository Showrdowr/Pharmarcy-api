import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { adminUser, adminAuditLogs } from './src/db/schema/admin-users';

const connectionString = 'postgres://postgres:1234@localhost:5433/pharmacy_academy_db';
const client = postgres(connectionString);
const db = drizzle(client);

async function check() {
  const users = await db.select().from(adminUser).limit(1);
  console.log('User date:', users[0]?.createAt, typeof users[0]?.createAt, users[0]?.createAt instanceof Date);

  const logs = await db.select().from(adminAuditLogs).limit(1);
  console.log('Log date (string):', logs[0]?.createAt, typeof logs[0]?.createAt);

  const res = await client`SELECT now()`;
  console.log('now():', res[0].now);
  
  process.exit(0);
}
check();
