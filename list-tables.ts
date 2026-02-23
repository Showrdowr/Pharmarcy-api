import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

// List all tables in the public schema
const tables = await sql`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

console.log('Total tables:', tables.length);
console.log('Tables list:', tables.map(t => t.table_name).join(', '));

await sql.end();
