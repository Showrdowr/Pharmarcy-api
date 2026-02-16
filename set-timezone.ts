import process from 'process';
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
    console.log('Setting database timezone to Asia/Bangkok...');
    
    // Set for the current database
    // Note: We need to know the DB name, but we can also set it for the user
    await sql`ALTER DATABASE pharmacy_academy_db SET timezone TO 'Asia/Bangkok'`;
    await sql`ALTER USER postgres SET timezone TO 'Asia/Bangkok'`;
    
    console.log('Timezone updated successfully.');
    
    // Check current time
    const result = await sql`SELECT now() as current_time`;
    console.log('Current Database Time:', result[0].current_time);

  } catch (err) {
    console.error('Error setting timezone:', err);
  } finally {
    await sql.end();
  }
}

main();
