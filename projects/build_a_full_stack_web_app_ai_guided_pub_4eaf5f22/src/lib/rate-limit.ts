import { getClientIp } from '@/lib/http';
import { getRateLimitPerMinute } from '@/lib/config';
import { AppError } from '@/lib/errors';

const rateLimitMap = new Map<string, { windowStart: number; count: number }>();
const MAX_ENTRIES = 10000;

/**
 * Evicts the entry with the oldest windowStart when the map size limit is exceeded.
 */
function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestWindowStart = Infinity;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.windowStart < oldestWindowStart) {
      oldestWindowStart = entry.windowStart;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) {
    rateLimitMap.delete(oldestKey);
  }
}

/**
 * Ensures the rate limiting map does not grow beyond the maximum allowed capacity.
 */
function ensureMapCap(key: string): void {
  if (!rateLimitMap.has(key) && rateLimitMap.size >= MAX_ENTRIES) {
    evictOldest();
  }
}

/**
 * Enforces rate limiting on a specific bucket. Increments the hit count if not limited.
 * Throws a 429 AppError if the limit is exceeded.
 */
export function enforceRateLimit(
  bucket: string,
  req: Request,
  opts?: { limit?: number; windowMs?: number }
): void {
  const limit = opts?.limit ?? getRateLimitPerMinute();
  const windowMs = opts?.windowMs ?? 60000;
  const ip = getClientIp(req);
  const key = bucket + '|' + ip;
  const now = Date.now();

  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    ensureMapCap(key);
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(key, entry);
  }

  if (entry.count >= limit) {
    const windowRemainder = Math.max(0, windowMs - (now - entry.windowStart));
    const retryAfterSeconds = Math.ceil(windowRemainder / 1000);
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
      { retryAfterSeconds }
    );
  }

  entry.count++;
}

/**
 * Checks if the rate limit for a specific bucket is exceeded without incrementing the count.
 * Throws a 429 AppError if the limit is exceeded.
 */
export function rateLimitCheck(
  bucket: string,
  req: Request,
  limit: number,
  windowMs: number
): void {
  const ip = getClientIp(req);
  const key = bucket + '|' + ip;
  const now = Date.now();

  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    ensureMapCap(key);
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(key, entry);
  }

  if (entry.count >= limit) {
    const windowRemainder = Math.max(0, windowMs - (now - entry.windowStart));
    const retryAfterSeconds = Math.ceil(windowRemainder / 1000);
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
      { retryAfterSeconds }
    );
  }
}

/**
 * Consumes/increments the rate limit count for a specific bucket.
 */
export function rateLimitConsume(
  bucket: string,
  req: Request,
  windowMs = 60000
): void {
  const ip = getClientIp(req);
  const key = bucket + '|' + ip;
  const now = Date.now();

  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    ensureMapCap(key);
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(key, entry);
  }

  entry.count++;
}

/**
 * Resets all active rate limiters. Intended for testing environments.
 */
export function _resetRateLimitForTests(): void {
  rateLimitMap.clear();
}
