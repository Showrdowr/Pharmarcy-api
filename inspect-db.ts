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
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in database:');
    tables.forEach((t: any) => console.log(`- ${t.table_name}`));

    const columns = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    console.log('\nColumns in users table:');
    columns.forEach((col: any) => console.log(`- ${col.column_name}: ${col.data_type} (${col.udt_name})`));
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await sql.end();
  }
}

main();
