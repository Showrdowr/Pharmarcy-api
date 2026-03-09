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
    const result = await sql`SELECT id, email, role, failed_attempts, created_at FROM users`;
    console.log(`Total users in DB: ${result.length}`);
    console.log('User Details:');
    result.forEach((row: any) => {
      console.log(`- ID: ${row.id}, Email: ${row.email}, Role: ${row.role}, Failed: ${row.failed_attempts}, Created: ${row.created_at}`);
    });

    const roleCounts = await sql`SELECT role, count(*) as count FROM users GROUP BY role`;
    console.log('\nRole Distribution:');
    roleCounts.forEach((row: any) => {
      console.log(`- ${row.role}: ${row.count}`);
    });

    // New query to select role and failed_attempts
    const roleFailedAttempts = await sql`SELECT role, failed_attempts FROM users`;
    console.log('\nRole and Failed Attempts:');
    roleFailedAttempts.forEach((row: any) => {
      console.log(`- Role: ${row.role}, Failed Attempts: ${row.failed_attempts}`);
    });
    
    if (result.length === 0) {
      console.log('No users found in database.');
    }
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await sql.end();
  }
}

main();
