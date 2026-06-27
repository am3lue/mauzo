import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

// Memory-efficient sliding window rate limiter implementation
export class SlidingWindowRateLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private ipRecords: Map<string, RateLimitRecord>;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(windowSizeMs: number = 60 * 1000, maxRequests: number = 60) {
    this.windowSizeMs = windowSizeMs;
    this.maxRequests = maxRequests;
    this.ipRecords = new Map();

    // Periodically prune stale IP records to prevent memory leaks in continuous runtime environments
    this.pruneTimer = setInterval(() => this.pruneStaleRecords(), 5 * 60 * 1000); // every 5 minutes
    if (typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
      (this.pruneTimer as any).unref();
    }
  }

  /** Release interval timer for cleanup (e.g. during HMR or serverless warm boot) */
  public destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.ipRecords.clear();
  }

  public isAllowed(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const threshold = now - this.windowSizeMs;

    let record = this.ipRecords.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.ipRecords.set(ip, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter(time => time > threshold);

    if (record.timestamps.length >= this.maxRequests) {
      const oldestActive = record.timestamps[0];
      const resetTime = oldestActive + this.windowSizeMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    // Record new request timestamp
    record.timestamps.push(now);
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetTime: now + this.windowSizeMs
    };
  }

  private pruneStaleRecords() {
    const now = Date.now();
    const threshold = now - this.windowSizeMs;

    for (const [ip, record] of this.ipRecords.entries()) {
      record.timestamps = record.timestamps.filter(time => time > threshold);
      if (record.timestamps.length === 0) {
        this.ipRecords.delete(ip);
      }
    }
  }
}

// Create singleton rate limiters for different sensitivity thresholds
const generalRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 100); // 100 req/min for health/pulls
const writeRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 30);    // 30 sync updates/min
const imageRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 10);    // 10 heavy uploads/min

// Express Middleware Guards
export function rateLimitMiddleware(type: 'general' | 'write' | 'upload') {
  const limiter = type === 'upload' ? imageRateLimiter : (type === 'write' ? writeRateLimiter : generalRateLimiter);

  return (req: Request, res: Response, next: NextFunction) => {
    // Standard secure extraction of client IP, supporting Vercel/Cloud Run headers
    const clientIp = (req.headers['x-forwarded-for'] as string) || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';

    const cleanIp = clientIp.split(',')[0].trim();
    const check = limiter.isAllowed(cleanIp);

    res.setHeader('X-RateLimit-Limit', limiter['maxRequests']);
    res.setHeader('X-RateLimit-Remaining', check.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(check.resetTime / 1000));

    if (!check.allowed) {
      console.warn(`[SECURITY] Rate limit exceeded for IP: ${cleanIp} on path: ${req.originalUrl}`);
      return res.status(429).json({
        error: 'Umevuka kikomo cha maombi ya usalama kwa sekunde hii. Tafadhali subiri kwanza kisha ujaribu tena.',
        retryAfterSeconds: Math.ceil((check.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

// Request Payload Size Inspector Middleware
export function requestSizeVerification(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSizeBytes) {
      console.warn(`[SECURITY] Large Request Rejected: Content-Length of ${contentLength} exceeds ceiling of ${maxSizeBytes}`);
      return res.status(413).json({
        error: `Maudhui ya ombi lako ni makubwa mno. Ukomo wa juu kabisa wa usalama ulioruhusiwa ni ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`
      });
    }
    next();
  };
}
