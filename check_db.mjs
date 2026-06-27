import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('TURSO_DATABASE_URL not set in .env');
  process.exit(1);
}

const client = createClient({ url, authToken: token?.trim() });

async function main() {
  console.log('=== Products by store_code ===');
  const r1 = await client.execute("SELECT store_code, count(*) as count FROM products GROUP BY store_code");
  for (const row of r1.rows) {
    console.log(`  ${row.store_code}: ${row.count} products`);
  }

  console.log('\n=== Sample products with their store_code ===');
  const r2 = await client.execute("SELECT id, store_code, name FROM products LIMIT 10");
  for (const row of r2.rows) {
    console.log(`  id="${row.id}" store_code="${row.store_code}" name="${row.name}"`);
  }

  console.log('\n=== Users by store_code ===');
  const r3 = await client.execute("SELECT store_code, count(*) as count FROM users GROUP BY store_code");
  for (const row of r3.rows) {
    console.log(`  ${row.store_code}: ${row.count} users`);
  }

  const r4 = await client.execute("SELECT id, name, role FROM users LIMIT 10");
  console.log('\n=== Users ===');
  for (const row of r4.rows) {
    console.log(`  id="${row.id}" name="${row.name}" role="${row.role}" store_code="${row.store_code}"`);
  }
}

main().catch(console.error);
