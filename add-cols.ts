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
    console.log('Adding created_at and updated_at to users table...');
    
    // Check if columns exist first to be safe
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    const colNames = columns.map((c: any) => c.column_name);

    if (!colNames.includes('created_at')) {
      await sql`ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
      console.log('Added created_at');
    } else {
      console.log('created_at already exists');
    }

    if (!colNames.includes('updated_at')) {
      await sql`ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
      console.log('Added updated_at');
    } else {
      console.log('updated_at already exists');
    }

    console.log('Columns added successfully.');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    await sql.end();
  }
}

main();
