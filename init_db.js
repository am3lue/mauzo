import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function initializeDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  console.log('🚀 Turso DB Relational Initialization Script');
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
    // Schema validation & migration check
    let shouldDropProducts = false;
    let shouldDropSellingLogs = false;
    let shouldDropUsers = false;

    try {
      const prodInfo = await client.execute("PRAGMA table_info(products)");
      const cols = prodInfo.rows.map(r => String(r.name).toLowerCase());
      if (cols.length > 0 && !cols.includes("price")) {
        shouldDropProducts = true;
      }
    } catch (e) {}

    try {
      const salesInfo = await client.execute("PRAGMA table_info(selling_logs)");
      const cols = salesInfo.rows.map(r => String(r.name).toLowerCase());
      if (cols.length > 0 && !cols.includes("items")) {
        shouldDropSellingLogs = true;
      }
    } catch (e) {}

    try {
      const usersInfo = await client.execute("PRAGMA table_info(users)");
      const cols = usersInfo.rows.map(r => String(r.name).toLowerCase());
      if (cols.length > 0 && !cols.includes("pin")) {
        shouldDropUsers = true;
      }
    } catch (e) {}

    if (shouldDropProducts) {
      console.log("⚠️ Old products table structure detected. Recreating...");
      await client.execute("DROP TABLE IF EXISTS products");
    }
    if (shouldDropSellingLogs) {
      console.log("⚠️ Old selling_logs table structure detected. Recreating...");
      await client.execute("DROP TABLE IF EXISTS selling_logs");
    }
    if (shouldDropUsers) {
      console.log("⚠️ Old users table structure detected. Recreating...");
      await client.execute("DROP TABLE IF EXISTS users");
    }

    // 1. Create products table
    console.log('🔄 Kinatengeneza jedwali la "products" (Bidhaa/Stoki) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT NOT NULL,
        store_code TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT,
        image TEXT,
        stock INTEGER NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        PRIMARY KEY (id, store_code)
      );
    `);
    console.log('✅ Jedwali la "products" liko tayari.');

    // 2. Create selling_logs table
    console.log('🔄 Kinatengeneza jedwali la "selling_logs" (Kumbukumbu za Mauzo) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS selling_logs (
        id TEXT NOT NULL,
        store_code TEXT NOT NULL,
        items TEXT,
        total REAL,
        amount_received REAL,
        change_given REAL,
        seller_id TEXT,
        seller_name TEXT,
        created_at TEXT,
        updated_at TEXT,
        is_debt INTEGER,
        debtor_name TEXT,
        debtor_phone TEXT,
        debt_status TEXT,
        debt_paid_amount REAL,
        PRIMARY KEY (id, store_code)
      );
    `);
    console.log('✅ Jedwali la "selling_logs" liko tayari.');

    // 3. Create users table
    console.log('🔄 Kinatengeneza jedwali la "users" (Watumiaji wa Mfumo) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT NOT NULL,
        store_code TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin TEXT,
        created_at TEXT,
        PRIMARY KEY (id, store_code)
      );
    `);
    console.log('✅ Jedwali la "users" liko tayari.');

    // 4. Create locks table
    console.log('🔄 Kinatengeneza jedwali la "locks" (Locking leases) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS locks (
        store_code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
    console.log('✅ Jedwali la "locks" liko tayari.');

    // 5. Create sessions table
    console.log('🔄 Kinatengeneza jedwali la "sessions" (Store sync sessions) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        store_code TEXT PRIMARY KEY,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('✅ Jedwali la "sessions" liko tayari.');

    // 6. Create user_sessions table
    console.log('🔄 Kinatengeneza jedwali la "user_sessions" (User device sessions) ikiwa halipo...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        store_code TEXT NOT NULL,
        user_id TEXT NOT NULL,
        device_name TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
    console.log('✅ Jedwali la "user_sessions" liko tayari.');

    // 7. Create Indexes
    console.log('⚡ Kinatengeneza index za kurahisisha utafutaji haraka (Indexes)...');
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_code);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_selling_logs_store ON selling_logs(store_code);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_code);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_sessions_store_user ON user_sessions(store_code, user_id);`);

    console.log('==================================================');
    console.log('✅ HURA! Majedwali yote matano yameanzishwa kikamilifu kwenye Turso DB yako!');
    console.log('Sasa duka lako linaweza kusawazisha (Sync) na kuhifadhi data kwa urahisi.');
  } catch (err) {
    console.error('❌ Hitilafu wakati wa kuanzisha database ya Turso:', err.message || err);
    process.exit(1);
  } finally {
    client.close();
  }
}

initializeDatabase();
