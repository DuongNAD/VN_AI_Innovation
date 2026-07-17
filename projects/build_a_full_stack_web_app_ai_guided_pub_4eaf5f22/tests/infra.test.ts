import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cachedJson,
  _resetCacheForTests,
} from '@/lib/cache';
import { enforceRateLimit, _resetRateLimitForTests } from '@/lib/rate-limit';
import { AppError } from '@/lib/errors';

function reqFrom(ip: string): Request {
  return new Request('http://localhost/api', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('cache · in-memory driver', () => {
  beforeEach(() => _resetCacheForTests());

  it('stores and returns a value, and deletes it', () => {
    cacheSet('k', 'v', 60);
    expect(cacheGet('k')).toBe('v');
    cacheDel('k');
    expect(cacheGet('k')).toBeNull();
  });

  it('treats an expired entry as a miss', () => {
    cacheSet('k', 'v', 0); // ttl 0s -> already expired
    expect(cacheGet('k')).toBeNull();
  });

  it('cachedJson computes once then replays with cacheHit=true', async () => {
    let calls = 0;
    const produce = async () => {
      calls++;
      return { n: 42 };
    };
    const first = await cachedJson('cj', 60, produce);
    expect(first).toEqual({ value: { n: 42 }, cacheHit: false });

    const second = await cachedJson('cj', 60, produce);
    expect(second).toEqual({ value: { n: 42 }, cacheHit: true });
    expect(calls).toBe(1); // produce ran exactly once
  });
});

describe('rate-limit · fixed window', () => {
  beforeEach(() => _resetRateLimitForTests());

  it('allows up to the limit then throws a 429 with Retry-After', () => {
    const req = reqFrom('203.0.113.5');
    const opts = { limit: 3, windowMs: 60000 };

    expect(() => enforceRateLimit('search', req, opts)).not.toThrow();
    expect(() => enforceRateLimit('search', req, opts)).not.toThrow();
    expect(() => enforceRateLimit('search', req, opts)).not.toThrow();

    try {
      enforceRateLimit('search', req, opts);
      throw new Error('expected the 4th call to be rate-limited');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const appErr = e as AppError;
      expect(appErr.status).toBe(429);
      expect(appErr.code).toBe('RATE_LIMITED');
      const details = (appErr as any).details ?? {};
      expect(details.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('keeps separate buckets independent', () => {
    const req = reqFrom('203.0.113.9');
    const opts = { limit: 1, windowMs: 60000 };
    expect(() => enforceRateLimit('bucket-a', req, opts)).not.toThrow();
    // A different bucket has its own counter.
    expect(() => enforceRateLimit('bucket-b', req, opts)).not.toThrow();
    // The first bucket is now exhausted.
    expect(() => enforceRateLimit('bucket-a', req, opts)).toThrow();
  });
});
