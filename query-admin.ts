import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

// Check if admin_users table exists
const tables = await sql`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE '%admin%'
`;
console.log('Admin tables:', tables);

// If exists, show columns
if (tables.length > 0) {
  for (const t of tables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = ${t.table_name}
      ORDER BY ordinal_position
    `;
    console.log(`\nColumns of ${t.table_name}:`);
    console.log(JSON.stringify(cols, null, 2));
  }
}

await sql.end();
