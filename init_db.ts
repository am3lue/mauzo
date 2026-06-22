import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function initializeDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !url.trim()) {
    console.error('⚠️  TURSO_DATABASE_URL haiko kwenye mazingira yako (.env au Secrets)!');
    console.log('Tafadhali hakikisha umeweka TURSO_DATABASE_URL na TURSO_AUTH_TOKEN kwenye siri (Secrets).');
    process.exit(1);
  }

  console.log('🔌 Inatafuta mawasiliano na Turso DB...');
  console.log(`🔗 URL: ${url.trim().substring(0, 30)}...`);

  const client = createClient({
    url: url.trim(),
    authToken: token ? token.trim() : undefined,
  });

  try {
    console.log('🔄 Kinatengeneza jedwali la "mauzo_sync" ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS mauzo_sync (
        store_code TEXT PRIMARY KEY,
        sales_data TEXT,
        products_data TEXT,
        users_data TEXT,
        updated_at INTEGER
      );
    `);

    // Ensure the users_data column is present if the table was created under the older schema
    try {
      console.log('🔄 Kinajaribu kuongeza safu ya "users_data" kwenye jedwali la "mauzo_sync" ikiwa haipo...');
      await client.execute(`ALTER TABLE mauzo_sync ADD COLUMN users_data TEXT;`);
      console.log('✅ Safu ya "users_data" imehakikishwa (Altered/Already present).');
    } catch {
      // safe to fail if it was already altered or created with this column
      console.log('ℹ️ Safu ya "users_data" tayari ipo au haikuweza kuongezwa.');
    }

    console.log('🔄 Kinatengeneza jedwali la "mauzo_locks" ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS mauzo_locks (
        store_code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    console.log('✅ HONGERA! Majedwali yote mawili yamewezeshwa kikamilifu kwenye Turso DB yako.');
  } catch (err: any) {
    console.error('❌ Hitilafu ilitokea wakati wa kuweka schema kwenye database ya Turso:', err?.message || err);
    process.exit(1);
  } finally {
    client.close();
  }
}

initializeDatabase();
