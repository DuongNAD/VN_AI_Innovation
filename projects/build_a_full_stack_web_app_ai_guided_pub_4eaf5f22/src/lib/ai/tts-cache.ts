import { Buffer } from 'buffer';
import { prisma } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';

export interface CachedTts {
  audio: Buffer;
  mimeType: string;
  model: string;
}

export interface CachedTtsHit extends CachedTts {
  // Which tier served the hit — surfaced as X-Cache-Tier for observability and
  // to make the durable tier verifiable after a restart.
  tier: 'l1' | 'l2';
}

// L1 (in-process, lib/cache) is a hot-path accelerator: it saves a DB round-trip
// and Buffer transfer for the keys a single instance sees repeatedly, but it is
// bounded, TTL'd, and lost on restart. L2 (Postgres TtsCache) is the durable,
// shared tier — the one that actually stops us re-paying the TTS upstream for
// identical text across restarts and across serverless instances.
const L1_TTL_SECONDS = 3600;

// Audio above this is streamed to the client but never cached, to bound both the
// in-process map and a single DB row. ~750 KB binary ≈ 1 MB base64, matching the
// previous in-memory-only threshold and far larger than the short clips the UI
// sends (text is capped well before synthesis).
const MAX_CACHEABLE_BYTES = 750_000;

// The synthesize endpoint is session-gated and rate-limited but still public, so
// bound durable storage with LRU eviction keyed on lastAccessedAt. Pruning runs
// opportunistically (every PRUNE_EVERY writes per instance) to avoid a DELETE on
// every request; cache hits — the common case once warm — don't write at all.
const L2_MAX_ENTRIES = 5000;
const PRUNE_EVERY = 200;

let writesSincePrune = 0;

function readL1(key: string): CachedTts | null {
  const raw = cacheGet(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.b64 === 'string' &&
      typeof parsed.mimeType === 'string' &&
      typeof parsed.model === 'string'
    ) {
      return {
        audio: Buffer.from(parsed.b64, 'base64'),
        mimeType: parsed.mimeType,
        model: parsed.model,
      };
    }
  } catch {
    // Corrupt entry -> treat as a miss.
  }
  return null;
}

function writeL1(key: string, value: CachedTts): void {
  cacheSet(
    key,
    JSON.stringify({
      b64: value.audio.toString('base64'),
      mimeType: value.mimeType,
      model: value.model,
    }),
    L1_TTL_SECONDS
  );
}

/**
 * Look up cached audio for a key across both tiers. Returns null on a miss or if
 * the durable tier is unreachable (e.g. DB down or the table not migrated yet) —
 * callers then synthesize as normal, so the cache only ever helps, never breaks
 * the request.
 */
export async function ttsCacheGet(key: string): Promise<CachedTtsHit | null> {
  const l1 = readL1(key);
  if (l1) {
    return { ...l1, tier: 'l1' };
  }

  let row: { audio: Buffer; mimeType: string; model: string } | null;
  try {
    row = await prisma.ttsCache.findUnique({
      where: { key },
      select: { audio: true, mimeType: true, model: true },
    });
  } catch (err) {
    // Durable tier unavailable -> behave as an L1-only cache.
    console.error('TTS cache L2 read failed:', err);
    return null;
  }
  if (!row) {
    return null;
  }

  const value: CachedTts = {
    audio: Buffer.from(row.audio),
    mimeType: row.mimeType,
    model: row.model,
  };
  writeL1(key, value);

  // Best-effort LRU bookkeeping; never block the response or fail on it.
  prisma.ttsCache
    .update({ where: { key }, data: { lastAccessedAt: new Date() } })
    .catch(() => {});

  return { ...value, tier: 'l2' };
}

/**
 * Persist synthesized audio to both tiers. Oversized audio is skipped. Durable
 * writes are best-effort: a DB failure is logged and swallowed so it can never
 * turn a successful synthesis into a failed response.
 */
export async function ttsCacheSet(key: string, value: CachedTts): Promise<void> {
  if (value.audio.byteLength > MAX_CACHEABLE_BYTES) {
    return;
  }

  writeL1(key, value);

  try {
    await prisma.ttsCache.upsert({
      where: { key },
      create: {
        key,
        mimeType: value.mimeType,
        model: value.model,
        audio: value.audio,
        byteSize: value.audio.byteLength,
      },
      update: {
        // Audio is deterministic for a key; refresh recency and tolerate any
        // mime/model drift from an upstream change.
        mimeType: value.mimeType,
        model: value.model,
        audio: value.audio,
        byteSize: value.audio.byteLength,
        lastAccessedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('TTS cache L2 write failed:', err);
    return;
  }

  writesSincePrune += 1;
  if (writesSincePrune >= PRUNE_EVERY) {
    writesSincePrune = 0;
    // Keep the L2_MAX_ENTRIES most-recently-accessed rows, drop the rest.
    prisma.$executeRaw`
      DELETE FROM "TtsCache"
      WHERE "key" IN (
        SELECT "key" FROM "TtsCache"
        ORDER BY "lastAccessedAt" DESC
        OFFSET ${L2_MAX_ENTRIES}
      )
    `.catch((err) => {
      console.error('TTS cache L2 prune failed:', err);
    });
  }
}
