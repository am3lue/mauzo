import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function initializeDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  console.log('🚀 Turso DB Plain JavaScript Initialization Script');
  console.log('==================================================');

  if (!url || !url.trim()) {
    console.error('❌ Error: TURSO_DATABASE_URL haiko kwenye mazingira yako (.env au Secrets)!');
    console.log('Tafadhali hakikisha umeweka TURSO_DATABASE_URL na TURSO_AUTH_TOKEN kwenye siri (Secrets).');
    process.exit(1);
  }

  console.log('🔌 Inatafuta mawasiliano na Turso DB...');
  console.log(`🔗 URL: ${url.trim().substring(0, 35)}...`);

  const client = createClient({
    url: url.trim(),
    authToken: token ? token.trim() : undefined,
  });

  try {
    // 1. Create mauzo_sync table
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
    console.log('✅ Jedwali la "mauzo_sync" liko tayari.');

    // 2. Schema drift verification: ensure users_data column exists
    try {
      console.log('🔄 Kinajaribu kuhakikisha safu ya "users_data" kwenye jedwali la "mauzo_sync" ipo...');
      await client.execute(`ALTER TABLE mauzo_sync ADD COLUMN users_data TEXT;`);
      console.log('✅ Safu ya "users_data" imehakikishwa (Altered/Already present).');
    } catch {
      // safe to fail if it was already altered or created with this column
      console.log('ℹ️ Safu ya "users_data" tayari ipo au haikuweza kuongezwa.');
    }

    // 3. Create mauzo_locks table
    console.log('🔄 Kinatengeneza jedwali la "mauzo_locks" ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS mauzo_locks (
        store_code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
    console.log('✅ Jedwali la "mauzo_locks" liko tayari.');

    console.log('==================================================');
    console.log('✅ HURA! Majedwali yote mawili yameanzishwa kikamilifu kwenye Turso DB yako!');
    console.log('Sasa unaweza kuendesha mfumo na kusawazisha (Sync) bila matatizo yoyote.');
  } catch (err) {
    console.error('❌ Hitilafu wakati wa kuanzisha database ya Turso:', err.message || err);
    process.exit(1);
  } finally {
    client.close();
  }
}

initializeDatabase();
