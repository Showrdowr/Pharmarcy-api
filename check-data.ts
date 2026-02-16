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
    const result = await sql`SELECT id, email, created_at, updated_at FROM users LIMIT 5`;
    console.log('Data in users table:');
    result.forEach((row: any) => {
      console.log(`- ID: ${row.id}, Email: ${row.email}, Created: ${row.created_at}, Updated: ${row.updated_at}`);
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
