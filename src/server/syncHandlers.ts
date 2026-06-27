import { getDbRepository, IDbRepository } from '../lib/dbRepository.js';

let _db: IDbRepository | null = null;
function db(): IDbRepository {
  if (!_db) _db = getDbRepository();
  return _db;
}

/**
 * Sync handler for reading sales data from SQLite/Turso.
 * Maps the GET /api/sync/:code/sales endpoint to relational SQL queries under-the-hood.
 */
export async function getSalesHandler(storeCode: string): Promise<any[]> {
  const data = await db().getSyncData(storeCode);
  if (data && data.salesData) {
    return JSON.parse(data.salesData);
  }
  return [];
}

export async function saveSalesHandler(storeCode: string, sales: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(sales);
  return await db().saveSyncData(storeCode, 'sales_data', dataJson);
}

export async function getProductsHandler(storeCode: string): Promise<any[]> {
  const data = await db().getSyncData(storeCode);
  if (data && data.productsData) {
    return JSON.parse(data.productsData);
  }
  return [];
}

export async function saveProductsHandler(storeCode: string, products: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(products);
  return await db().saveSyncData(storeCode, 'products_data', dataJson);
}

export async function getUsersHandler(storeCode: string): Promise<any[]> {
  const data = await db().getSyncData(storeCode);
  if (data && data.usersData) {
    return JSON.parse(data.usersData);
  }
  return [];
}

export async function saveUsersHandler(storeCode: string, users: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(users);
  return await db().saveSyncData(storeCode, 'users_data', dataJson);
}

export async function acquireLockHandler(
  storeCode: string,
  clientId: string,
  leaseMs: number
): Promise<{ success: boolean; owner: string; expiresAt: number }> {
  return await db().acquireLock(storeCode, clientId, leaseMs);
}

export async function releaseLockHandler(storeCode: string, clientId: string): Promise<boolean> {
  return await db().releaseLock(storeCode, clientId);
}
