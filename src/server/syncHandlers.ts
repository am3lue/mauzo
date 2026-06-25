import { getDbRepository } from '../lib/dbRepository.js';

const db = getDbRepository();

/**
 * Sync handler for reading sales data from SQLite/Turso.
 * Maps the GET /api/sync/:code/sales endpoint to relational SQL queries under-the-hood.
 */
export async function getSalesHandler(storeCode: string): Promise<any[]> {
  const data = await db.getSyncData(storeCode);
  if (data && data.salesData) {
    return JSON.parse(data.salesData);
  }
  return [];
}

/**
 * Sync handler for writing sales data to SQLite/Turso with proper relational SQL mapped storage.
 * Maps the PUT /api/sync/:code/sales endpoint.
 */
export async function saveSalesHandler(storeCode: string, sales: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(sales);
  return await db.saveSyncData(storeCode, 'sales_data', dataJson);
}

/**
 * Sync handler for reading products from SQLite/Turso.
 * Maps the GET /api/sync/:code/products endpoint.
 */
export async function getProductsHandler(storeCode: string): Promise<any[]> {
  const data = await db.getSyncData(storeCode);
  if (data && data.productsData) {
    return JSON.parse(data.productsData);
  }
  return [];
}

/**
 * Sync handler for writing products to SQLite/Turso.
 * Maps the PUT /api/sync/:code/products endpoint.
 */
export async function saveProductsHandler(storeCode: string, products: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(products);
  return await db.saveSyncData(storeCode, 'products_data', dataJson);
}

/**
 * Sync handler for reading users from SQLite/Turso.
 * Maps the GET /api/sync/:code/users endpoint.
 */
export async function getUsersHandler(storeCode: string): Promise<any[]> {
  const data = await db.getSyncData(storeCode);
  if (data && data.usersData) {
    return JSON.parse(data.usersData);
  }
  return [];
}

/**
 * Sync handler for writing users to SQLite/Turso.
 * Maps the PUT /api/sync/:code/users endpoint.
 */
export async function saveUsersHandler(storeCode: string, users: any[]): Promise<boolean> {
  const dataJson = JSON.stringify(users);
  return await db.saveSyncData(storeCode, 'users_data', dataJson);
}

/**
 * Sync handler for acquiring write/lock leases.
 * Maps the POST /api/sync/:code/lock endpoint.
 */
export async function acquireLockHandler(
  storeCode: string,
  clientId: string,
  leaseMs: number
): Promise<{ success: boolean; owner: string; expiresAt: number }> {
  return await db.acquireLock(storeCode, clientId, leaseMs);
}

/**
 * Sync handler for releasing write/lock leases.
 * Maps the POST /api/sync/:code/unlock endpoint.
 */
export async function releaseLockHandler(storeCode: string, clientId: string): Promise<boolean> {
  return await db.releaseLock(storeCode, clientId);
}
