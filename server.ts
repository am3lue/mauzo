import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';

const STORAGE_DIR = '/tmp/mauzo_sync_store';
const IMAGES_DIR = path.join(STORAGE_DIR, 'images');

// Ensure writable storage directory & local image backup storage exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Memory lock storage fallback for when Turso is not being used
interface LockInfo {
  clientId: string;
  expiresAt: number;
}
const currentLocks = new Map<string, LockInfo>();

// ------------------ Turso Database Configuration ------------------
let libsqlClient: ReturnType<typeof createClient> | null = null;
let tablesEnsured = false;

function getLibsqlClient() {
  if (!libsqlClient) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (url && url.trim()) {
      libsqlClient = createClient({
        url: url.trim(),
        authToken: token ? token.trim() : undefined,
      });
      console.log('Turso client initialized with URL:', url.trim());
    }
  }
  return libsqlClient;
}

async function getActiveClient() {
  const client = getLibsqlClient();
  if (!client) return null;

  if (!tablesEnsured) {
    try {
      // Create schema dynamically on first use if not already constructed in the SQLite cloud
      await client.execute(`
        CREATE TABLE IF NOT EXISTS mauzo_sync (
          store_code TEXT PRIMARY KEY,
          sales_data TEXT,
          products_data TEXT,
          users_data TEXT,
          updated_at INTEGER
        );
      `);
      
      // Try to alter table in case database is already provisioned
      try {
        await client.execute(`ALTER TABLE mauzo_sync ADD COLUMN users_data TEXT;`);
      } catch (e) {
        // Column probably already exists, which is expected
      }

      await client.execute(`
        CREATE TABLE IF NOT EXISTS mauzo_locks (
          store_code TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
      `);
      tablesEnsured = true;
      console.log('Turso database tables verified and ensured.');
    } catch (err) {
      console.error('Error during Turso schema verification:', err);
    }
  }
  return client;
}

// ------------------ File System Storage Fallback Helper ------------------
function getSyncFilePath(code: string, prefix: string): string {
  const sanitizedCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
  return path.join(STORAGE_DIR, `mzo_${sanitizedCode}_${prefix}.json`);
}

function readSyncDataFromFile(code: string, prefix: string): any[] {
  const filePath = getSyncFilePath(code, prefix);
  if (fs.existsSync(filePath)) {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      if (text && text.trim()) {
        return JSON.parse(text);
      }
    } catch (e) {
      console.error(`Error reading flat file ${prefix} for ${code}:`, e);
    }
  }
  return [];
}

function writeSyncDataToFile(code: string, prefix: string, data: any[]): void {
  const filePath = getSyncFilePath(code, prefix);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing flat file ${prefix} for ${code}:`, e);
  }
}

// ------------------ Express Server Integration ------------------
const app = express();
const PORT = 3000;

// JSON Body Parser with robust limits for base64 image transfers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// API endpoints for direct, CORS-free multi-tab/multi-device Sync
app.get('/api/health', async (req, res) => {
  const client = await getActiveClient();
  res.json({
    status: 'ok',
    hasImgbbKey: !!process.env.IMGBB_API_KEY,
    hasTursoDb: !!client,
    storage: STORAGE_DIR,
    activeLocksInMemory: currentLocks.size
  });
});

// ImgBB / Local Image Upload Endpoint
app.post('/api/upload', async (req, res) => {
  try {
    const { image, name } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Ukurasa unahitaji faili la picha.' });
    }

    // Cleanup base64 prefixes if any
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const finalName = name ? name.replace(/[^a-zA-Z0-9.-]/g, '_') : `product_${Date.now()}.jpg`;

    const imgbbKey = process.env.IMGBB_API_KEY;
    if (imgbbKey && imgbbKey.trim()) {
      // 1. Upload to ImgBB securely server-side using URLSearchParams
      const params = new URLSearchParams();
      params.append('image', base64Data);
      params.append('name', finalName.split('.')[0]);

      const uploadUrl = `https://api.imgbb.com/1/upload?key=${imgbbKey.trim()}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`ImgBB API responded with ${response.status}: ${detail}`);
      }

      const result: any = await response.json();
      if (result && result.success && result.data && result.data.url) {
        return res.json({
          success: true,
          url: result.data.url,
          thumbUrl: result.data.thumb?.url || result.data.url,
          provider: 'imgbb'
        });
      } else {
        throw new Error('Imeshindwa kupata URL toka ImgBB format.');
      }
    } else {
      // 2. Local fallback storage when IMGBB_API_KEY setup is missing
      const buffer = Buffer.from(base64Data, 'base64');
      const uniqueFilename = `${Date.now()}_${finalName}`;
      const localImagePath = path.join(IMAGES_DIR, uniqueFilename);
      
      fs.writeFileSync(localImagePath, buffer);
      
      return res.json({
        success: true,
        url: `/api/images/${uniqueFilename}`,
        thumbUrl: `/api/images/${uniqueFilename}`,
        provider: 'local_disk_fallback',
        warning: 'Njia mbadala ya dharura inatumika (Local Storage). Kufikia mtandaoni kutoka vifaa vingine, weka secrets.'
      });
    }
  } catch (err: any) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: `Imeshindwa kukamilisha upakiaji: ${err?.message || err}` });
  }
});

// Serve locally cached images
app.get('/api/images/:filename', (req, res) => {
  const filePath = path.join(IMAGES_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Picha haikupatikana.');
  }
});

// LOCKING ENDPOINTS (Distributed locks over Turso or memory fallback)
app.post('/api/sync/:code/lock', async (req, res) => {
  const { code } = req.params;
  const { clientId } = req.body;
  const cleanCode = code.toUpperCase();

  if (!clientId) {
    return res.status(400).json({ success: false, message: "Kifaa (clientId) hakikutambulika." });
  }

  const now = Date.now();
  const client = await getActiveClient();

  if (client) {
    try {
      // Clean up expired locks from cloud SQLite to facilitate quick reuse
      await client.execute({
        sql: "DELETE FROM mauzo_locks WHERE expires_at < ?",
        args: [now]
      });

      // Fetch lock owner
      const result = await client.execute({
        sql: "SELECT client_id, expires_at FROM mauzo_locks WHERE store_code = ?",
        args: [cleanCode]
      });

      if (result.rows.length > 0) {
        const owner = result.rows[0].client_id as string;
        const expiresAt = result.rows[0].expires_at as number;

        if (owner !== clientId && now < expiresAt) {
          const remainingMs = Math.max(0, expiresAt - now);
          return res.json({
            success: false,
            message: `Duka lipo busy sasa hivi. Kifaa kingine kinafanyia marekebisho. Subiri sekunde ${Math.ceil(remainingMs / 1000)}...`,
            owner
          });
        }
      }

      // Claim / Renew Lock
      await client.execute({
        sql: `INSERT INTO mauzo_locks (store_code, client_id, expires_at) 
              VALUES (?, ?, ?) 
              ON CONFLICT(store_code) DO UPDATE SET 
              client_id = excluded.client_id, 
              expires_at = excluded.expires_at`,
        args: [cleanCode, clientId, now + 20000] // 20 seconds lease
      });

      return res.json({ success: true, message: "Lock imepatikana/imeratibiwa mapato (Turso)." });
    } catch (dbErr) {
      console.error('Turso locking failure, falling back: ', dbErr);
    }
  }

  // Memory fallback lock
  const existingLock = currentLocks.get(cleanCode);
  if (existingLock) {
    if (existingLock.clientId !== clientId && now < existingLock.expiresAt) {
      const remainingMs = Math.max(0, existingLock.expiresAt - now);
      return res.json({
        success: false,
        message: `Duka lipo busy. Kifaa kingine kinafanyia marekebisho sasa. Subiri sekunde ${Math.ceil(remainingMs / 1000)}...`,
        owner: existingLock.clientId
      });
    }
  }

  currentLocks.set(cleanCode, {
    clientId,
    expiresAt: now + 20000
  });

  res.json({ success: true, message: "Lock imepatikana (Memory Fallback)." });
});

app.post('/api/sync/:code/unlock', async (req, res) => {
  const { code } = req.params;
  const { clientId } = req.body;
  const cleanCode = code.toUpperCase();

  const client = await getActiveClient();
  if (client) {
    try {
      await client.execute({
        sql: "DELETE FROM mauzo_locks WHERE store_code = ? AND client_id = ?",
        args: [cleanCode, clientId]
      });
      return res.json({ success: true, message: "Lock imeachiliwa kikamilifu (Turso)." });
    } catch (dbErr) {
      console.error('Turso unlock failure, falling back:', dbErr);
    }
  }

  const existingLock = currentLocks.get(cleanCode);
  if (existingLock && existingLock.clientId === clientId) {
    currentLocks.delete(cleanCode);
    return res.json({ success: true, message: "Lock imeachiliwa kikamilifu (Memory)." });
  }

  res.json({ success: true, message: "Lock ilishaa-achiliwa tayari." });
});

// Sales Sync Endpoints
app.get('/api/sync/:code/sales', async (req, res) => {
  const { code } = req.params;
  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();

  const client = await getActiveClient();
  if (client) {
    try {
      const result = await client.execute({
        sql: "SELECT sales_data FROM mauzo_sync WHERE store_code = ?",
        args: [cleanCode]
      });
      if (result.rows.length > 0) {
        const val = result.rows[0].sales_data;
        if (typeof val === 'string' && val.trim()) {
          return res.json(JSON.parse(val));
        }
      }
      return res.json([]);
    } catch (dbErr) {
      console.error('Turso read sales error, falling back:', dbErr);
    }
  }

  const data = readSyncDataFromFile(cleanCode, 'sales');
  res.json(data);
});

app.put('/api/sync/:code/sales', async (req, res) => {
  const { code } = req.params;
  const salesPayload = req.body;
  if (!Array.isArray(salesPayload)) {
    return res.status(400).json({ error: 'Payload must be a JSON array' });
  }

  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
  const salesJsonStr = JSON.stringify(salesPayload);

  const client = await getActiveClient();
  if (client) {
    try {
      await client.execute({
        sql: `INSERT INTO mauzo_sync (store_code, sales_data, updated_at) 
              VALUES (?, ?, ?) 
              ON CONFLICT(store_code) DO UPDATE SET 
              sales_data = excluded.sales_data, 
              updated_at = excluded.updated_at`,
        args: [cleanCode, salesJsonStr, Date.now()]
      });
      return res.json({ status: 'success', count: salesPayload.length, provider: 'turso' });
    } catch (dbErr) {
      console.error('Turso write sales error, falling back:', dbErr);
    }
  }

  writeSyncDataToFile(cleanCode, 'sales', salesPayload);
  res.json({ status: 'success', count: salesPayload.length, provider: 'local_disk_fallback' });
});

// Products Sync Endpoints
app.get('/api/sync/:code/products', async (req, res) => {
  const { code } = req.params;
  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();

  const client = await getActiveClient();
  if (client) {
    try {
      const result = await client.execute({
        sql: "SELECT products_data FROM mauzo_sync WHERE store_code = ?",
        args: [cleanCode]
      });
      if (result.rows.length > 0) {
        const val = result.rows[0].products_data;
        if (typeof val === 'string' && val.trim()) {
          return res.json(JSON.parse(val));
        }
      }
      return res.json([]);
    } catch (dbErr) {
      console.error('Turso read products error, falling back:', dbErr);
    }
  }

  const data = readSyncDataFromFile(cleanCode, 'products');
  res.json(data);
});

app.put('/api/sync/:code/products', async (req, res) => {
  const { code } = req.params;
  const productsPayload = req.body;
  if (!Array.isArray(productsPayload)) {
    return res.status(400).json({ error: 'Payload must be a JSON array' });
  }

  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
  const productsJsonStr = JSON.stringify(productsPayload);

  const client = await getActiveClient();
  if (client) {
    try {
      await client.execute({
        sql: `INSERT INTO mauzo_sync (store_code, products_data, updated_at) 
              VALUES (?, ?, ?) 
              ON CONFLICT(store_code) DO UPDATE SET 
              products_data = excluded.products_data, 
              updated_at = excluded.updated_at`,
        args: [cleanCode, productsJsonStr, Date.now()]
      });
      return res.json({ status: 'success', count: productsPayload.length, provider: 'turso' });
    } catch (dbErr) {
      console.error('Turso write products error, falling back:', dbErr);
    }
  }

  writeSyncDataToFile(cleanCode, 'products', productsPayload);
  res.json({ status: 'success', count: productsPayload.length, provider: 'local_disk_fallback' });
});

// Users Sync Endpoints
app.get('/api/sync/:code/users', async (req, res) => {
  const { code } = req.params;
  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();

  const client = await getActiveClient();
  if (client) {
    try {
      const result = await client.execute({
        sql: "SELECT users_data FROM mauzo_sync WHERE store_code = ?",
        args: [cleanCode]
      });
      if (result.rows.length > 0) {
        const val = result.rows[0].users_data;
        if (typeof val === 'string' && val.trim()) {
          return res.json(JSON.parse(val));
        }
      }
      return res.json([]);
    } catch (dbErr) {
      console.error('Turso read users error, falling back:', dbErr);
    }
  }

  const data = readSyncDataFromFile(cleanCode, 'users');
  res.json(data);
});

app.put('/api/sync/:code/users', async (req, res) => {
  const { code } = req.params;
  const usersPayload = req.body;
  if (!Array.isArray(usersPayload)) {
    return res.status(400).json({ error: 'Payload must be a JSON array' });
  }

  const cleanCode = code.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
  const usersJsonStr = JSON.stringify(usersPayload);

  const client = await getActiveClient();
  if (client) {
    try {
      await client.execute({
        sql: `INSERT INTO mauzo_sync (store_code, users_data, updated_at) 
              VALUES (?, ?, ?) 
              ON CONFLICT(store_code) DO UPDATE SET 
              users_data = excluded.users_data, 
              updated_at = excluded.updated_at`,
        args: [cleanCode, usersJsonStr, Date.now()]
      });
      return res.json({ status: 'success', count: usersPayload.length, provider: 'turso' });
    } catch (dbErr) {
      console.error('Turso write users error, falling back:', dbErr);
    }
  }

  writeSyncDataToFile(cleanCode, 'users', usersPayload);
  res.json({ status: 'success', count: usersPayload.length, provider: 'local_disk_fallback' });
});

// Start routing configurations
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully started. Listening on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default app;
