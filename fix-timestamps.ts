import postgres from 'postgres';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString as string);

async function main() {
  console.log('Connecting to:', connectionString);
  try {
    console.log('Setting NOT NULL and DEFAULT for created_at and updated_at...');
    
    // Set defaults and not null
    await sql`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW()`;
    await sql`ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW()`;
    
    // Backfill existing nulls
    await sql`UPDATE users SET created_at = NOW() WHERE created_at IS NULL`;
    await sql`UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL`;
    
    // Make them NOT NULL 
    await sql`ALTER TABLE users ALTER COLUMN created_at SET NOT NULL`;
    await sql`ALTER TABLE users ALTER COLUMN updated_at SET NOT NULL`;

    console.log('Database schema updated and backfilled successfully.');
    
    // Final check
    const result = await sql`SELECT email, created_at, updated_at FROM users`;
    console.log('Current data:');
    result.forEach((row: any) => {
      console.log(`- ${row.email}: Created at ${row.created_at}`);
    });

  } catch (err) {
    console.error('Error updating database:', err);
  } finally {
    await sql.end();
  }
}

main();
