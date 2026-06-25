import fs from 'fs';
import path from 'path';

export interface UploadResult {
  success: boolean;
  url: string;
  thumbUrl: string;
  provider: 'imgbb' | 'local_disk_fallback' | string;
  warning?: string;
  error?: string;
}

// ------------------ Storage Adapter Interface ------------------
export interface IStorageAdapter {
  uploadImage(base64Data: string, originalFilename: string): Promise<UploadResult>;
  isHealthy(): Promise<boolean>;
}

// Helper to sanitize filename to prevent directory traversal and clean weird chars
function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename) || '.jpg';
  const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9-]/g, '_');
  return `${nameWithoutExt}${ext}`;
}

// Helper to validate Base64 string payload size and basic MIME header signature
export function validateImagePayload(base64Data: string, maxBytes: number = 8 * 1024 * 1024): { isValid: boolean; error?: string } {
  // Approximate size from base64 string
  const approxSize = (base64Data.length * 3) / 4;
  if (approxSize > maxBytes) {
    return {
      isValid: false,
      error: `Faili ni kubwa kupita kiasi. Ukomo wa juu ni ${Math.round(maxBytes / (1024 * 1024))}MB. Picha uliyoweka ina takriban ${Math.round(approxSize / (1024 * 1024))}MB.`
    };
  }

  // Basic image signature check (PNG, JPEG, WEBP, GIF, etc.)
  const header = base64Data.slice(0, 30);
  const isImage = header.includes('image/') || 
                  header.startsWith('iVBORw') || // PNG
                  header.startsWith('/9j/') ||   // JPEG
                  header.startsWith('UklGR') ||  // WEBP
                  header.startsWith('R0lGOD');    // GIF

  if (!isImage) {
    return {
      isValid: false,
      error: 'Aina ya faili iliyopakiwa haitambuliwi. Tafadhali weka picha halisi (JPEG, PNG, WEBP, au GIF).'
    };
  }

  return { isValid: true };
}

// ------------------ ImgBB Adapter with Exponential Backoff Retries ------------------
export class ImgbbStorageAdapter implements IStorageAdapter {
  private apiKey: string;
  private fallbackAdapter: IStorageAdapter;

  constructor(apiKey: string, fallbackAdapter: IStorageAdapter) {
    this.apiKey = apiKey.trim();
    this.fallbackAdapter = fallbackAdapter;
  }

  async uploadImage(base64Data: string, originalFilename: string): Promise<UploadResult> {
    const cleanedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const payloadValidation = validateImagePayload(cleanedBase64);
    
    if (!payloadValidation.isValid) {
      return {
        success: false,
        url: '',
        thumbUrl: '',
        provider: 'imgbb',
        error: payloadValidation.error
      };
    }

    const cleanName = sanitizeFilename(originalFilename).split('.')[0];
    const uploadUrl = `https://api.imgbb.com/1/upload?key=${this.apiKey}`;
    
    let attempt = 0;
    const maxAttempts = 3;
    let delay = 1000; // start with 1s delay

    while (attempt < maxAttempts) {
      try {
        const params = new URLSearchParams();
        params.append('image', cleanedBase64);
        params.append('name', cleanName);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds request timeout

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`ImgBB API returned status ${response.status}: ${detail}`);
        }

        const result: any = await response.json();
        if (result && result.success && result.data && result.data.url) {
          return {
            success: true,
            url: result.data.url,
            thumbUrl: result.data.thumb?.url || result.data.url,
            provider: 'imgbb'
          };
        } else {
          throw new Error('ImgBB JSON response parsing failed to retrieve standard image URLs.');
        }

      } catch (err: any) {
        attempt++;
        console.warn(`ImgBB upload attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);
        
        if (attempt < maxAttempts) {
          // Exponential backoff sleep
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          console.error('All ImgBB upload attempts exhausted. Triggering Local Storage Fallback Pipeline to preserve active user session...');
          return this.fallbackAdapter.uploadImage(base64Data, originalFilename);
        }
      }
    }

    // Unreachable fallback backup
    return this.fallbackAdapter.uploadImage(base64Data, originalFilename);
  }

  async isHealthy(): Promise<boolean> {
    return !!this.apiKey;
  }
}

// ------------------ Local Disk Adapter Implementation ------------------
export class LocalDiskStorageAdapter implements IStorageAdapter {
  private imagesDir: string;

  constructor(imagesDir: string) {
    this.imagesDir = imagesDir;
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  async uploadImage(base64Data: string, originalFilename: string): Promise<UploadResult> {
    try {
      const cleanedBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const payloadValidation = validateImagePayload(cleanedBase64);
      
      if (!payloadValidation.isValid) {
        return {
          success: false,
          url: '',
          thumbUrl: '',
          provider: 'local_disk_fallback',
          error: payloadValidation.error
        };
      }

      const cleanFilename = sanitizeFilename(originalFilename);
      const uniqueFilename = `${Date.now()}_${cleanFilename}`;
      const absolutePath = path.join(this.imagesDir, uniqueFilename);

      const buffer = Buffer.from(cleanedBase64, 'base64');
      fs.writeFileSync(absolutePath, buffer);

      const clientUrl = `/api/images/${uniqueFilename}`;

      return {
        success: true,
        url: clientUrl,
        thumbUrl: clientUrl,
        provider: 'local_disk_fallback',
        warning: 'Imetumia njia mbadala ya dharura (Picha imehifadhiwa ndani ya mashine ya duka). Ili wengine waione mtandaoni, sanidi API key.'
      };
    } catch (err: any) {
      console.error('Local disk write operations failed completely:', err);
      return {
        success: false,
        url: '',
        thumbUrl: '',
        provider: 'local_disk_fallback',
        error: `Inashindwa kuhifadhi picha hata kwenye mashine: ${err?.message || err}`
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    return fs.existsSync(this.imagesDir);
  }
}

// ------------------ Storage Adapter Unified Factory ------------------
let storageAdapterInstance: IStorageAdapter | null = null;

export function getStorageAdapter(): IStorageAdapter {
  if (storageAdapterInstance) return storageAdapterInstance;

  const storageDir = '/tmp/mauzo_sync_store';
  const imagesDir = path.join(storageDir, 'images');
  const imgbbKey = process.env.IMGBB_API_KEY;

  const localAdapter = new LocalDiskStorageAdapter(imagesDir);

  if (imgbbKey && imgbbKey.trim()) {
    storageAdapterInstance = new ImgbbStorageAdapter(imgbbKey.trim(), localAdapter);
    console.log('✓ Secure ImgbbStorageAdapter active with LocalDiskStorageAdapter fallback capability.');
  } else {
    storageAdapterInstance = localAdapter;
    console.warn('⚠️ Warning: IMGBB_API_KEY environment variable is missing. Running pure LocalDiskStorageAdapter.');
  }

  return storageAdapterInstance;
}
