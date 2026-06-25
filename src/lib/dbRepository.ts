import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

// Core entity types matched with current application models
export interface SyncData {
  storeCode: string;
  salesData: string; // Serialized JSON string
  productsData: string; // Serialized JSON string
  usersData: string; // Serialized JSON string
  updatedAt: number;
}

export interface LockInfo {
  storeCode: string;
  clientId: string;
  expiresAt: number;
}

// ------------------ DB Repository Interface ------------------
export interface IDbRepository {
  initialize(): Promise<void>;
  getSyncData(storeCode: string): Promise<Partial<SyncData> | null>;
  saveSyncData(storeCode: string, column: 'sales_data' | 'products_data' | 'users_data', dataJson: string): Promise<boolean>;
  acquireLock(storeCode: string, clientId: string, leaseMs: number): Promise<{ success: boolean; owner: string; expiresAt: number }>;
  releaseLock(storeCode: string, clientId: string): Promise<boolean>;
  getLockOwner(storeCode: string): Promise<LockInfo | null>;
  isHealthy(): Promise<boolean>;

  // New user sessions persistence
  saveUserSession(session: {
    sessionId: string;
    storeCode: string;
    userId: string;
    deviceName?: string;
    status: 'active' | 'logged_out';
    createdAt: number;
    expiresAt: number;
  }): Promise<boolean>;
  getUserSession(sessionId: string): Promise<any | null>;
  getUserSessions(storeCode: string, userId?: string): Promise<any[]>;
}

// ------------------ Turso (libSQL) Implementation ------------------
export class TursoDbRepository implements IDbRepository {
  private client: ReturnType<typeof createClient>;
  private isInitialized = false;

  constructor(url: string, token?: string) {
    this.client = createClient({
      url: url.trim(),
      authToken: token ? token.trim() : undefined,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Schema validation & migration check
      let shouldDropProducts = false;
      let shouldDropSellingLogs = false;
      let shouldDropUsers = false;

      try {
        const prodInfo = await this.client.execute("PRAGMA table_info(products)");
        const cols = prodInfo.rows.map(r => String(r.name).toLowerCase());
        if (cols.length > 0 && !cols.includes("price")) {
          shouldDropProducts = true;
        }
      } catch (e) {}

      try {
        const salesInfo = await this.client.execute("PRAGMA table_info(selling_logs)");
        const cols = salesInfo.rows.map(r => String(r.name).toLowerCase());
        if (cols.length > 0 && !cols.includes("items")) {
          shouldDropSellingLogs = true;
        }
      } catch (e) {}

      try {
        const usersInfo = await this.client.execute("PRAGMA table_info(users)");
        const cols = usersInfo.rows.map(r => String(r.name).toLowerCase());
        if (cols.length > 0 && !cols.includes("pin")) {
          shouldDropUsers = true;
        }
      } catch (e) {}

      if (shouldDropProducts) {
        console.log("⚠️ Old products table structure detected. Recreating...");
        await this.client.execute("DROP TABLE IF EXISTS products");
      }
      if (shouldDropSellingLogs) {
        console.log("⚠️ Old selling_logs table structure detected. Recreating...");
        await this.client.execute("DROP TABLE IF EXISTS selling_logs");
      }
      if (shouldDropUsers) {
        console.log("⚠️ Old users table structure detected. Recreating...");
        await this.client.execute("DROP TABLE IF EXISTS users");
      }

      // 1. Create products table
      await this.client.execute(`
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

      // 2. Create selling_logs table
      await this.client.execute(`
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

      // 3. Create users table
      await this.client.execute(`
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

      // 4. Create locks table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS locks (
          store_code TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `);

      // 5. Create sessions table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          store_code TEXT PRIMARY KEY,
          updated_at INTEGER NOT NULL
        );
      `);

      // 6. Create user_sessions table
      await this.client.execute(`
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

      // Create indexes for fast query routing
      await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_code);`);
      await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_selling_logs_store ON selling_logs(store_code);`);
      await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_code);`);
      await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_user_sessions_store_user ON user_sessions(store_code, user_id);`);

      this.isInitialized = true;
      console.log('✓ Turso (libSQL) Database Repository initialized successfully with active schema.');
    } catch (err) {
      console.error('CRITICAL: Turso DB initialization failed:', err);
      throw err;
    }
  }

  async getSyncData(storeCode: string): Promise<Partial<SyncData> | null> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();

    try {
      // 1. Get products
      const productsRes = await this.client.execute({
        sql: `SELECT id, name, price, category, image, stock, created_at, updated_at FROM products WHERE store_code = ?`,
        args: [cleanCode]
      });
      const products = productsRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        price: row.price,
        category: row.category,
        image: row.image,
        stock: row.stock,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      // 2. Get selling logs
      const salesRes = await this.client.execute({
        sql: `SELECT id, items, total, amount_received, change_given, seller_id, seller_name, created_at, updated_at, is_debt, debtor_name, debtor_phone, debt_status, debt_paid_amount FROM selling_logs WHERE store_code = ?`,
        args: [cleanCode]
      });
      const sales = salesRes.rows.map(row => ({
        id: row.id,
        items: JSON.parse((row.items as string) || '[]'),
        total: row.total,
        amountReceived: row.amount_received,
        changeGiven: row.change_given,
        sellerId: row.seller_id,
        sellerName: row.seller_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isDebt: row.is_debt === 1,
        debtorName: row.debtor_name || undefined,
        debtorPhone: row.debtor_phone || undefined,
        debtStatus: row.debt_status || undefined,
        debtPaidAmount: row.debt_paid_amount || 0
      }));

      // 3. Get users
      const usersRes = await this.client.execute({
        sql: `SELECT id, name, role, pin FROM users WHERE store_code = ?`,
        args: [cleanCode]
      });
      const users = usersRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        role: row.role,
        pin: row.pin || undefined
      }));

      // 4. Get session updatedAt
      const sessionRes = await this.client.execute({
        sql: `SELECT updated_at FROM sessions WHERE store_code = ?`,
        args: [cleanCode]
      });
      const updatedAt = sessionRes.rows.length > 0 ? (sessionRes.rows[0].updated_at as number) : Date.now();

      return {
        storeCode: cleanCode,
        salesData: JSON.stringify(sales),
        productsData: JSON.stringify(products),
        usersData: JSON.stringify(users),
        updatedAt
      };
    } catch (err) {
      console.error(`Turso getSyncData failure for ${cleanCode}:`, err);
      throw err;
    }
  }

  async saveSyncData(
    storeCode: string,
    column: 'sales_data' | 'products_data' | 'users_data',
    dataJson: string
  ): Promise<boolean> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();
    const now = Date.now();

    try {
      const records = JSON.parse(dataJson);
      if (!Array.isArray(records)) {
        throw new Error('Data payload is not an array');
      }

      if (column === 'sales_data') {
        // 1. Delete existing sales
        await this.client.execute({
          sql: `DELETE FROM selling_logs WHERE store_code = ?`,
          args: [cleanCode]
        });

        // 2. Insert new sales
        for (const s of records) {
          await this.client.execute({
            sql: `INSERT INTO selling_logs (
              id, store_code, items, total, amount_received, change_given, seller_id, seller_name, 
              created_at, updated_at, is_debt, debtor_name, debtor_phone, debt_status, debt_paid_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              s.id,
              cleanCode,
              JSON.stringify(s.items || []),
              s.total || 0,
              s.amountReceived || 0,
              s.changeGiven || 0,
              s.sellerId || '',
              s.sellerName || '',
              s.createdAt,
              s.updatedAt || s.createdAt,
              s.isDebt ? 1 : 0,
              s.debtorName || null,
              s.debtorPhone || null,
              s.debtStatus || null,
              s.debtPaidAmount || 0
            ]
          });
        }
      } else if (column === 'products_data') {
        // 1. Delete existing products
        await this.client.execute({
          sql: `DELETE FROM products WHERE store_code = ?`,
          args: [cleanCode]
        });

        // 2. Insert new products
        for (const p of records) {
          await this.client.execute({
            sql: `INSERT INTO products (
              id, store_code, name, price, category, image, stock, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              p.id,
              cleanCode,
              p.name,
              p.price || 0,
              p.category || null,
              p.image || null,
              p.stock || 0,
              p.createdAt,
              p.updatedAt || p.createdAt
            ]
          });
        }
      } else if (column === 'users_data') {
        // 1. Delete existing users
        await this.client.execute({
          sql: `DELETE FROM users WHERE store_code = ?`,
          args: [cleanCode]
        });

        // 2. Insert new users
        for (const u of records) {
          await this.client.execute({
            sql: `INSERT INTO users (
              id, store_code, name, role, pin, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              u.id,
              cleanCode,
              u.name,
              u.role,
              u.pin || null,
              new Date().toISOString()
            ]
          });
        }
      }

      // 3. Update session updated_at timestamp
      await this.client.execute({
        sql: `
          INSERT INTO sessions (store_code, updated_at)
          VALUES (?, ?)
          ON CONFLICT(store_code) DO UPDATE SET
            updated_at = excluded.updated_at
        `,
        args: [cleanCode, now]
      });

      return true;
    } catch (err) {
      console.error(`Turso saveSyncData failure for store ${cleanCode} in column ${column}:`, err);
      return false;
    }
  }

  async acquireLock(storeCode: string, clientId: string, leaseMs: number): Promise<{ success: boolean; owner: string; expiresAt: number }> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();
    const now = Date.now();
    const expiresAt = now + leaseMs;

    try {
      // 1. Flush stale, expired locks
      await this.client.execute({
        sql: `DELETE FROM locks WHERE expires_at < ?`,
        args: [now]
      });

      // 2. Query active lock status
      const current = await this.client.execute({
        sql: `SELECT client_id, expires_at FROM locks WHERE store_code = ?`,
        args: [cleanCode]
      });

      if (current.rows.length > 0) {
        const activeOwner = current.rows[0].client_id as string;
        const activeExpiry = current.rows[0].expires_at as number;

        if (activeOwner !== clientId && now < activeExpiry) {
          return { success: false, owner: activeOwner, expiresAt: activeExpiry };
        }
      }

      // 3. Bind new lock lease ownership
      await this.client.execute({
        sql: `
          INSERT INTO locks (store_code, client_id, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(store_code) DO UPDATE SET
            client_id = excluded.client_id,
            expires_at = excluded.expires_at
        `,
        args: [cleanCode, clientId, expiresAt]
      });

      return { success: true, owner: clientId, expiresAt };
    } catch (err) {
      console.error(`Turso acquireLock error for ${cleanCode} by ${clientId}:`, err);
      return { success: false, owner: '', expiresAt: 0 };
    }
  }

  async releaseLock(storeCode: string, clientId: string): Promise<boolean> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();

    try {
      const result = await this.client.execute({
        sql: `DELETE FROM locks WHERE store_code = ? AND client_id = ?`,
        args: [cleanCode, clientId]
      });
      return (result.rowsAffected || 0) > 0;
    } catch (err) {
      console.error(`Turso releaseLock error for ${cleanCode} by ${clientId}:`, err);
      return false;
    }
  }

  async getLockOwner(storeCode: string): Promise<LockInfo | null> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();

    try {
      const result = await this.client.execute({
        sql: `SELECT client_id, expires_at FROM locks WHERE store_code = ?`,
        args: [cleanCode]
      });

      if (result.rows.length === 0) {
        return null;
      }

      return {
        storeCode: cleanCode,
        clientId: result.rows[0].client_id as string,
        expiresAt: result.rows[0].expires_at as number
      };
    } catch (err) {
      console.error(`Turso getLockOwner error for ${cleanCode}:`, err);
      return null;
    }
  }

  async saveUserSession(session: {
    sessionId: string;
    storeCode: string;
    userId: string;
    deviceName?: string;
    status: 'active' | 'logged_out';
    createdAt: number;
    expiresAt: number;
  }): Promise<boolean> {
    await this.initialize();
    try {
      await this.client.execute({
        sql: `
          INSERT INTO user_sessions (session_id, store_code, user_id, device_name, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            status = excluded.status,
            expires_at = excluded.expires_at
        `,
        args: [
          session.sessionId,
          session.storeCode.toUpperCase(),
          session.userId,
          session.deviceName || null,
          session.status,
          session.createdAt,
          session.expiresAt
        ]
      });
      return true;
    } catch (err) {
      console.error('Turso saveUserSession error:', err);
      return false;
    }
  }

  async getUserSession(sessionId: string): Promise<any | null> {
    await this.initialize();
    try {
      const result = await this.client.execute({
        sql: `SELECT session_id, store_code, user_id, device_name, status, created_at, expires_at FROM user_sessions WHERE session_id = ?`,
        args: [sessionId]
      });
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        storeCode: row.store_code,
        userId: row.user_id,
        deviceName: row.device_name,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      };
    } catch (err) {
      console.error('Turso getUserSession error:', err);
      return null;
    }
  }

  async getUserSessions(storeCode: string, userId?: string): Promise<any[]> {
    await this.initialize();
    const cleanCode = storeCode.toUpperCase().trim();
    try {
      let sql = `SELECT session_id, store_code, user_id, device_name, status, created_at, expires_at FROM user_sessions WHERE store_code = ?`;
      const args: any[] = [cleanCode];
      if (userId) {
        sql += ` AND user_id = ?`;
        args.push(userId);
      }
      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => ({
        sessionId: row.session_id,
        storeCode: row.store_code,
        userId: row.user_id,
        deviceName: row.device_name,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      }));
    } catch (err) {
      console.error('Turso getUserSessions error:', err);
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.execute(`SELECT 1;`);
      return true;
    } catch {
      return false;
    }
  }
}

// ------------------ Local File System Implementation ------------------
export class FileSystemDbRepository implements IDbRepository {
  private baseDir: string;
  private locks: Map<string, { clientId: string; expiresAt: number }> = new Map();
  private sessionMap: Map<string, any> = new Map();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    // Already verified base directory is established in constructor
  }

  private getFilePath(storeCode: string, prefix: string): string {
    const sanitizedCode = storeCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
    return path.join(this.baseDir, `mzo_${sanitizedCode}_${prefix}.json`);
  }

  private readData(storeCode: string, prefix: string): string {
    const filePath = this.getFilePath(storeCode, prefix);
    if (fs.existsSync(filePath)) {
      try {
        const text = fs.readFileSync(filePath, 'utf-8');
        if (text && text.trim()) {
          // Verify valid JSON
          JSON.parse(text);
          return text;
        }
      } catch (err) {
        console.error(`FileSystemDbRepository fallback parse error for ${prefix}:`, err);
      }
    }
    return '[]';
  }

  private writeData(storeCode: string, prefix: string, dataJson: string): void {
    const filePath = this.getFilePath(storeCode, prefix);
    try {
      // Validate string compiles to JSON before flat-file persistence
      JSON.parse(dataJson);
      fs.writeFileSync(filePath, dataJson, 'utf-8');
    } catch (err) {
      console.error(`FileSystemDbRepository write failure for ${prefix}:`, err);
    }
  }

  async getSyncData(storeCode: string): Promise<Partial<SyncData> | null> {
    const cleanCode = storeCode.toUpperCase().trim();
    
    // Read the three core database tables from partitioned flat files
    const salesData = this.readData(cleanCode, 'sales');
    const productsData = this.readData(cleanCode, 'products');
    const usersData = this.readData(cleanCode, 'users');

    return {
      storeCode: cleanCode,
      salesData,
      productsData,
      usersData,
      updatedAt: Date.now()
    };
  }

  async saveSyncData(
    storeCode: string,
    column: 'sales_data' | 'products_data' | 'users_data',
    dataJson: string
  ): Promise<boolean> {
    const cleanCode = storeCode.toUpperCase().trim();
    const prefix = column === 'sales_data' ? 'sales' : (column === 'products_data' ? 'products' : 'users');
    
    this.writeData(cleanCode, prefix, dataJson);
    return true;
  }

  async acquireLock(storeCode: string, clientId: string, leaseMs: number): Promise<{ success: boolean; owner: string; expiresAt: number }> {
    const cleanCode = storeCode.toUpperCase().trim();
    const now = Date.now();
    const expiresAt = now + leaseMs;

    const current = this.locks.get(cleanCode);
    if (current && current.clientId !== clientId && now < current.expiresAt) {
      return { success: false, owner: current.clientId, expiresAt: current.expiresAt };
    }

    this.locks.set(cleanCode, { clientId, expiresAt });
    return { success: true, owner: clientId, expiresAt };
  }

  async releaseLock(storeCode: string, clientId: string): Promise<boolean> {
    const cleanCode = storeCode.toUpperCase().trim();
    const current = this.locks.get(cleanCode);
    if (current && current.clientId === clientId) {
      this.locks.delete(cleanCode);
      return true;
    }
    return false;
  }

  async getLockOwner(storeCode: string): Promise<LockInfo | null> {
    const cleanCode = storeCode.toUpperCase().trim();
    const current = this.locks.get(cleanCode);
    if (!current || Date.now() > current.expiresAt) {
      return null;
    }
    return {
      storeCode: cleanCode,
      clientId: current.clientId,
      expiresAt: current.expiresAt
    };
  }

  async saveUserSession(session: {
    sessionId: string;
    storeCode: string;
    userId: string;
    deviceName?: string;
    status: 'active' | 'logged_out';
    createdAt: number;
    expiresAt: number;
  }): Promise<boolean> {
    this.sessionMap.set(session.sessionId, { ...session, storeCode: session.storeCode.toUpperCase() });
    return true;
  }

  async getUserSession(sessionId: string): Promise<any | null> {
    return this.sessionMap.get(sessionId) || null;
  }

  async getUserSessions(storeCode: string, userId?: string): Promise<any[]> {
    const cleanCode = storeCode.toUpperCase().trim();
    const all = Array.from(this.sessionMap.values());
    return all.filter(s => {
      const matchStore = s.storeCode === cleanCode;
      if (!matchStore) return false;
      if (userId) return s.userId === userId;
      return true;
    });
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

// ------------------ DB Repository Unified Factory ------------------
let repositoryInstance: IDbRepository | null = null;

export function getDbRepository(): IDbRepository {
  if (repositoryInstance) return repositoryInstance;

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  const storageDir = '/tmp/mauzo_sync_store';

  if (url && url.trim()) {
    repositoryInstance = new TursoDbRepository(url.trim(), token);
  } else {
    repositoryInstance = new FileSystemDbRepository(storageDir);
    console.warn('⚠️ Warning: TURSO_DATABASE_URL environment variable is missing. Running FileSystemDbRepository on path:', storageDir);
  }

  return repositoryInstance;
}
