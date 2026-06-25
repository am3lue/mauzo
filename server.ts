import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Architectural repository, adapter, and rate limiter imports
import { getDbRepository } from './src/lib/dbRepository.js';
import { getStorageAdapter } from './src/lib/storageAdapter.js';
import { rateLimitMiddleware, requestSizeVerification } from './src/lib/rateLimiter.js';

const PORT = 3000;
const app = express();

// Set up security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// JSON and URL-encoded payload Parsers with secure ceiling limits (max 15MB base64 transfers)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Initialize DB and Storage on boot up
const db = getDbRepository();
const storage = getStorageAdapter();

// ------------------ API Routes ------------------

// 1. Health & Infrastructure Status Endpoint
app.get('/api/health', rateLimitMiddleware('general'), async (req, res) => {
  try {
    const dbHealthy = await db.isHealthy();
    const storageHealthy = await storage.isHealthy();

    res.json({
      status: 'ok',
      timestamp: Date.now(),
      securityGuardsActive: true,
      infrastructure: {
        database: dbHealthy ? 'healthy' : 'degraded',
        storage: storageHealthy ? 'healthy' : 'degraded',
        isLocalFallbackDb: db.constructor.name === 'FileSystemDbRepository',
        isLocalFallbackStorage: storage.constructor.name === 'LocalDiskStorageAdapter'
      }
    });
  } catch (err: any) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'unhealthy', error: err?.message || err });
  }
});

// 2. High-Performance Secure Image Upload Endpoint (Guarded by Upload Rate Limiters)
app.post('/api/upload', 
  rateLimitMiddleware('upload'), 
  requestSizeVerification(15 * 1024 * 1024), 
  async (req, res) => {
    try {
      const { image, name } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Ukurasa unahitaji faili la picha.' });
      }

      const originalFilename = name || `product_${Date.now()}.jpg`;
      
      // Delegation to storage adapter pattern - handles resizing, validation, retries and disk backups
      const result = await storage.uploadImage(image, originalFilename);

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json({ error: result.error || 'Upakiaji wa picha ulishindwa.' });
      }
    } catch (err: any) {
      console.error('Upload endpoint controller failure:', err);
      res.status(500).json({ error: `Kosa la ndani wakati wa kupakia picha: ${err?.message || err}` });
    }
  }
);

// 3. Local Image Cache Server (Secure filename protection mapping)
app.get('/api/images/:filename', rateLimitMiddleware('general'), (req, res) => {
  const safeFilename = req.params.filename.replace(/[^a-zA-Z0-9_.-]/g, '');
  const filePath = path.join('/tmp/mauzo_sync_store/images', safeFilename);

  if (fs.existsSync(filePath)) {
    // Explicit content safety header matching for images
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } else {
    res.status(404).send('Picha haikupatikana.');
  }
});

// 4. Client Locking Endpoints (Guarded by Write Rate Limiters for lock flood protection)
app.post('/api/sync/:code/lock', rateLimitMiddleware('write'), async (req, res) => {
  const { code } = req.params;
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, message: 'Kifaa (clientId) hakikutambulika.' });
  }

  try {
    const leaseMs = 20000; // Standardized lease window (20 seconds)
    const result = await db.acquireLock(code, clientId, leaseMs);

    if (result.success) {
      return res.json({ success: true, message: 'Lock imepatikana/imeratibiwa kikamilifu.' });
    } else {
      const remainingMs = Math.max(0, result.expiresAt - Date.now());
      return res.json({
        success: false,
        message: `Duka lipo busy sasa hivi. Kifaa kingine kinafanyia marekebisho. Subiri sekunde ${Math.ceil(remainingMs / 1000)}...`,
        owner: result.owner
      });
    }
  } catch (err: any) {
    console.error(`Locking routine failure for store ${code}:`, err);
    res.status(500).json({ success: false, message: 'Hitilafu wakati wa kutengeneza lock.' });
  }
});

app.post('/api/sync/:code/unlock', rateLimitMiddleware('write'), async (req, res) => {
  const { code } = req.params;
  const { clientId } = req.body;

  if (!clientId) {
    return res.status(400).json({ success: false, message: 'Kifaa (clientId) hakikutambulika.' });
  }

  try {
    const released = await db.releaseLock(code, clientId);
    return res.json({ success: released, message: released ? 'Lock imeachiliwa.' : 'Hukuwa mmiliki wa lock au lock ishafutika.' });
  } catch (err: any) {
    console.error(`Unlock routine failure for store ${code}:`, err);
    res.status(500).json({ success: false, message: 'Hitilafu wakati wa kuachilia lock.' });
  }
});

// 5. Sales Sync Endpoints
app.get('/api/sync/:code/sales', rateLimitMiddleware('general'), async (req, res) => {
  const { code } = req.params;
  try {
    const data = await db.getSyncData(code);
    if (data && data.salesData) {
      return res.json(JSON.parse(data.salesData));
    }
    return res.json([]);
  } catch (err: any) {
    console.error(`Fetch sales failure for ${code}:`, err);
    res.status(500).json({ error: 'Inashindwa kusoma data ya mauzo.' });
  }
});

app.put('/api/sync/:code/sales', 
  rateLimitMiddleware('write'), 
  requestSizeVerification(15 * 1024 * 1024), 
  async (req, res) => {
    const { code } = req.params;
    const salesPayload = req.body;

    if (!Array.isArray(salesPayload)) {
      return res.status(400).json({ error: 'Payload lazima iwe array ya JSON.' });
    }

    try {
      const dataJson = JSON.stringify(salesPayload);
      const success = await db.saveSyncData(code, 'sales_data', dataJson);
      if (success) {
        return res.json({ status: 'success', count: salesPayload.length });
      }
      throw new Error('Database returned failure during upsert operation.');
    } catch (err: any) {
      console.error(`Save sales failure for ${code}:`, err);
      res.status(500).json({ error: 'Inashindwa kuhifadhi data ya mauzo.' });
    }
  }
);

// 6. Products Sync Endpoints
app.get('/api/sync/:code/products', rateLimitMiddleware('general'), async (req, res) => {
  const { code } = req.params;
  try {
    const data = await db.getSyncData(code);
    if (data && data.productsData) {
      return res.json(JSON.parse(data.productsData));
    }
    return res.json([]);
  } catch (err: any) {
    console.error(`Fetch products failure for ${code}:`, err);
    res.status(500).json({ error: 'Inashindwa kusoma data ya bidhaa.' });
  }
});

app.put('/api/sync/:code/products', 
  rateLimitMiddleware('write'), 
  requestSizeVerification(15 * 1024 * 1024), 
  async (req, res) => {
    const { code } = req.params;
    const productsPayload = req.body;

    if (!Array.isArray(productsPayload)) {
      return res.status(400).json({ error: 'Payload lazima iwe array ya JSON.' });
    }

    try {
      const dataJson = JSON.stringify(productsPayload);
      const success = await db.saveSyncData(code, 'products_data', dataJson);
      if (success) {
        return res.json({ status: 'success', count: productsPayload.length });
      }
      throw new Error('Database returned failure during upsert operation.');
    } catch (err: any) {
      console.error(`Save products failure for ${code}:`, err);
      res.status(500).json({ error: 'Inashindwa kuhifadhi data ya bidhaa.' });
    }
  }
);

// 7. Users Sync Endpoints
app.get('/api/sync/:code/users', rateLimitMiddleware('general'), async (req, res) => {
  const { code } = req.params;
  try {
    const data = await db.getSyncData(code);
    if (data && data.usersData) {
      return res.json(JSON.parse(data.usersData));
    }
    return res.json([]);
  } catch (err: any) {
    console.error(`Fetch users failure for ${code}:`, err);
    res.status(500).json({ error: 'Inashindwa kusoma data ya watumiaji.' });
  }
});

app.put('/api/sync/:code/users', 
  rateLimitMiddleware('write'), 
  requestSizeVerification(15 * 1024 * 1024), 
  async (req, res) => {
    const { code } = req.params;
    const usersPayload = req.body;

    if (!Array.isArray(usersPayload)) {
      return res.status(400).json({ error: 'Payload lazima iwe array ya JSON.' });
    }

    try {
      const dataJson = JSON.stringify(usersPayload);
      const success = await db.saveSyncData(code, 'users_data', dataJson);
      if (success) {
        return res.json({ status: 'success', count: usersPayload.length });
      }
      throw new Error('Database returned failure during upsert operation.');
    } catch (err: any) {
      console.error(`Save users failure for ${code}:`, err);
      res.status(500).json({ error: 'Inashindwa kuhifadhi data ya watumiaji.' });
    }
  }
);

// ------------------ Vite & Static Asset Setup ------------------
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
    console.log(`🚀 Production Ready App Server started. Listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error('Server startup failed catastrophically:', error);
    process.exit(1);
  });
}

export default app;
