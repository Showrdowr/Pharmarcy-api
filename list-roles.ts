import { db } from './src/db/index.js';
import { roles } from './src/db/schema/index.js';

async function listRoles() {
  try {
    const allRoles = await db.select().from(roles);
    console.log('Roles in database:');
    console.table(allRoles);
    process.exit(0);
  } catch (err) {
    console.error('Error listing roles:', err);
    process.exit(1);
  }
}

listRoles();
