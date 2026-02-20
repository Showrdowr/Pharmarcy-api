import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP`);
  console.log('Done: added reset_otp and reset_otp_expires_at columns to users table');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
