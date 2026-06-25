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
      // Dynamic, schema-controlled table establishment with error-tolerant indexing
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS mauzo_sync (
          store_code TEXT PRIMARY KEY,
          sales_data TEXT,
          products_data TEXT,
          users_data TEXT,
          updated_at INTEGER
        );
      `);

      // Schema drift management: ensure users_data column exists
      try {
        await this.client.execute(`ALTER TABLE mauzo_sync ADD COLUMN users_data TEXT;`);
      } catch (err) {
        // Ignored. Column is already established.
      }

      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS mauzo_locks (
          store_code TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `);

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
      const result = await this.client.execute({
        sql: `SELECT sales_data, products_data, users_data, updated_at FROM mauzo_sync WHERE store_code = ?`,
        args: [cleanCode]
      });

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        storeCode: cleanCode,
        salesData: (row.sales_data as string) || '[]',
        productsData: (row.products_data as string) || '[]',
        usersData: (row.users_data as string) || '[]',
        updatedAt: (row.updated_at as number) || 0
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
      // Use SQL upsert pattern with secure argument bindings to defend against injection attacks
      let sql = '';
      if (column === 'sales_data') {
        sql = `
          INSERT INTO mauzo_sync (store_code, sales_data, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(store_code) DO UPDATE SET
            sales_data = excluded.sales_data,
            updated_at = excluded.updated_at
        `;
      } else if (column === 'products_data') {
        sql = `
          INSERT INTO mauzo_sync (store_code, products_data, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(store_code) DO UPDATE SET
            products_data = excluded.products_data,
            updated_at = excluded.updated_at
        `;
      } else {
        sql = `
          INSERT INTO mauzo_sync (store_code, users_data, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(store_code) DO UPDATE SET
            users_data = excluded.users_data,
            updated_at = excluded.updated_at
        `;
      }

      await this.client.execute({
        sql,
        args: [cleanCode, dataJson, now]
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
      // 1. Flush stale, expired locks globally to prevent connection deadlock
      await this.client.execute({
        sql: `DELETE FROM mauzo_locks WHERE expires_at < ?`,
        args: [now]
      });

      // 2. Query active lock status with parameter safety
      const current = await this.client.execute({
        sql: `SELECT client_id, expires_at FROM mauzo_locks WHERE store_code = ?`,
        args: [cleanCode]
      });

      if (current.rows.length > 0) {
        const activeOwner = current.rows[0].client_id as string;
        const activeExpiry = current.rows[0].expires_at as number;

        if (activeOwner !== clientId && now < activeExpiry) {
          return { success: false, owner: activeOwner, expiresAt: activeExpiry };
        }
      }

      // 3. Bind new lock lease ownership with SQL transaction semantics
      await this.client.execute({
        sql: `
          INSERT INTO mauzo_locks (store_code, client_id, expires_at)
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
        sql: `DELETE FROM mauzo_locks WHERE store_code = ? AND client_id = ?`,
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
        sql: `SELECT client_id, expires_at FROM mauzo_locks WHERE store_code = ?`,
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
