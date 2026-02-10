import postgres from 'postgres';

const sql = postgres('postgresql://postgres:1234@localhost:5433/pharmacy_academy_db');

async function test() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log('Connected successfully!', result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Connection error:', message);
  } finally {
    await sql.end();
  }
}

test();
