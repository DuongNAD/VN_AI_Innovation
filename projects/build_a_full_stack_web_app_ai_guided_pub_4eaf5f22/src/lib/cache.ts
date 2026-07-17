interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key: string, value: string, ttlSeconds: number): void {
  if (cache.size >= 500 && !cache.has(key)) {
    let earliestKey: string | null = null;
    let earliestExpiresAt = Infinity;
    for (const [k, entry] of cache.entries()) {
      if (entry.expiresAt < earliestExpiresAt) {
        earliestExpiresAt = entry.expiresAt;
        earliestKey = k;
      }
    }
    if (earliestKey !== null) {
      cache.delete(earliestKey);
    }
  }
  const expiresAt = Date.now() + ttlSeconds * 1000;
  cache.set(key, { value, expiresAt });
}

export function cacheDel(key: string): void {
  cache.delete(key);
}

export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>
): Promise<{ value: T; cacheHit: boolean }> {
  const cachedStr = cacheGet(key);
  if (cachedStr !== null) {
    try {
      const value = JSON.parse(cachedStr) as T;
      return { value, cacheHit: true };
    } catch {
      // corrupt JSON on hit -> treat as miss and overwrite
    }
  }

  const value = await produce();
  cacheSet(key, JSON.stringify(value), ttlSeconds);
  return { value, cacheHit: false };
}

export function _resetCacheForTests(): void {
  cache.clear();
}