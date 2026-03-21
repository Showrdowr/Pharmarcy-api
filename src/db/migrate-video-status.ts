import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Adding video_status enum and columns to videos table...');

  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status') THEN
      CREATE TYPE video_status AS ENUM ('PROCESSING', 'READY', 'FAILED');
    END IF;
  END $$`;

  await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS status video_status NOT NULL DEFAULT 'PROCESSING'`;
  await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`;

  // Mark all existing videos as READY (they were already working before this migration)
  await sql`UPDATE videos SET status = 'READY' WHERE status = 'PROCESSING'`;

  console.log('Migration complete.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
