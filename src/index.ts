process.env.TZ = 'Asia/Bangkok';
import { buildApp } from './app.js';
import { env } from './config/env.js';

import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  const app = await buildApp();

  try {
    // Check DB connection
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connected successfully');

    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 Server running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
