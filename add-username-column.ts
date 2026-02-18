import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function addColumn() {
  try {
    console.log('Adding username column...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;`;
    console.log('Column added successfully.');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    await sql.end();
  }
}

addColumn();
