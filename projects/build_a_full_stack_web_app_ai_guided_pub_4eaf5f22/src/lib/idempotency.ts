import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma, PrismaTx } from './db';
import { AppError } from './errors';

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
    Object.setPrototypeOf(this, CanonicalJsonError.prototype);
  }
}

export const MAX_DEPTH = 256;
export const MAX_NODES = 100000;

function isPlainObject(val: unknown): boolean {
  if (val === null || typeof val !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function walk(
  val: unknown,
  depth: number,
  state: { nodeCount: number; ancestors: Set<unknown> }
): string {
  if (depth > MAX_DEPTH) {
    throw new CanonicalJsonError('Nesting depth limit exceeded');
  }

  state.nodeCount++;
  if (state.nodeCount > MAX_NODES) {
    throw new CanonicalJsonError('Max nodes limit exceeded');
  }

  if (val === null) {
    return 'null';
  }

  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new CanonicalJsonError('Invalid numeric value');
    }
    if (Object.is(val, -0)) {
      return '0';
    }
    return JSON.stringify(val);
  }

  if (typeof val === 'string') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    if (state.ancestors.has(val)) {
      throw new CanonicalJsonError('Circular reference detected');
    }
    state.ancestors.add(val);
    const items: string[] = [];
    for (let i = 0; i < val.length; i++) {
      items.push(walk(val[i], depth + 1, state));
    }
    state.ancestors.delete(val);
    return '[' + items.join(',') + ']';
  }

  if (typeof val === 'object') {
    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== null) {
      throw new CanonicalJsonError('Non-plain object is not allowed');
    }

    if (state.ancestors.has(val)) {
      throw new CanonicalJsonError('Circular reference detected');
    }
    state.ancestors.add(val);

    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs: string[] = [];
    for (const key of keys) {
      const propVal = obj[key];
      const serializedKey = JSON.stringify(key);
      const serializedVal = walk(propVal, depth + 1, state);
      pairs.push(`${serializedKey}:${serializedVal}`);
    }

    state.ancestors.delete(val);
    return '{' + pairs.join(',') + '}';
  }

  throw new CanonicalJsonError(`Unsupported value type: ${typeof val}`);
}

export function canonicalJson(value: unknown): string {
  const state = {
    nodeCount: 0,
    ancestors: new Set<unknown>(),
  };
  return walk(value, 0, state);
}

function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export type IdempotencyDescriptor = {
  storageKey: string;
  requestHash: string;
};

export function buildIdempotencyKey(parts: {
  operation: string;
  resourceId: string;
  sessionId?: string;
  messageId?: string;
  body?: unknown;
}): IdempotencyDescriptor | null {
  if (!parts.messageId) {
    return null;
  }

  const identity = [
    parts.operation,
    parts.resourceId,
    parts.sessionId ?? '',
    parts.messageId,
  ];

  return {
    storageKey: sha256hex(canonicalJson(identity)),
    requestHash: sha256hex(canonicalJson(parts.body ?? null)),
  };
}

class IdempotencyConflict extends Error {
  readonly principalId: string;
  readonly key: string;

  constructor(principalId: string, key: string) {
    super('Idempotency conflict');
    this.name = 'IdempotencyConflict';
    this.principalId = principalId;
    this.key = key;
    Object.setPrototypeOf(this, IdempotencyConflict.prototype);
  }
}

const IDEMPOTENCY_ENVELOPE_VERSION = 1;
const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let nextCleanupAt = 0;

function packStoredResponse(requestHash: string, response: unknown): Record<string, unknown> {
  return {
    __idempotency: {
      version: IDEMPOTENCY_ENVELOPE_VERSION,
      requestHash,
    },
    response,
  };
}

function unpackStoredResponse(
  stored: unknown,
  expectedRequestHash: string
): unknown {
  if (!isPlainObject(stored)) {
    throw new Error('Broken invariant: invalid idempotency response envelope');
  }

  const envelope = stored as Record<string, unknown>;
  if (!isPlainObject(envelope.__idempotency)) {
    throw new Error('Broken invariant: missing idempotency response metadata');
  }

  const metadata = envelope.__idempotency as Record<string, unknown>;
  if (
    metadata.version !== IDEMPOTENCY_ENVELOPE_VERSION ||
    typeof metadata.requestHash !== 'string'
  ) {
    throw new Error('Broken invariant: invalid idempotency response metadata');
  }

  if (metadata.requestHash !== expectedRequestHash) {
    throw new AppError(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'Mã yêu cầu đã được sử dụng với nội dung khác.'
    );
  }

  return envelope.response;
}

async function maybeCleanupExpiredRecords(): Promise<void> {
  const now = Date.now();
  if (now < nextCleanupAt) {
    return;
  }
  nextCleanupAt = now + IDEMPOTENCY_CLEANUP_INTERVAL_MS;

  try {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now - IDEMPOTENCY_RETENTION_MS),
        },
      },
    });
  } catch (error) {
    console.error('Failed to clean expired idempotency records:', error);
  }
}

/**
 * Executes a database operation with exactly-once idempotency guarantees.
 * 
 * IMPORTANT: Callers MUST authenticate and authorize the principal before invoking this function.
 * Because lookups are scoped to the authenticated principal and operation identity, and the request's
 * principal is authorized before checking the database, returning the cached response
 * requires no further access control or revalidation checks.
 * 
 * @param principalId The server-derived authenticated principal (e.g. session user ID).
 * @param descriptor Stable operation identity plus a separate request hash, or null to bypass.
 * @param exec The function performing database operations through the provided transaction client.
 */
export async function withIdempotency(
  principalId: string,
  descriptor: IdempotencyDescriptor | null,
  exec: (tx: PrismaTx) => Promise<{ status: number; body: unknown }>
): Promise<{ status: number; body: unknown; replayed: boolean }> {
  if (typeof principalId !== 'string' || principalId.trim() === '') {
    throw new TypeError('principalId must be a non-empty string');
  }

  if (descriptor === null) {
    const r = await prisma.$transaction(exec);
    return { ...r, replayed: false };
  }

  await maybeCleanupExpiredRecords();
  const { storageKey, requestHash } = descriptor;

  try {
    const result = await prisma.$transaction(async (tx) => {
      try {
        await tx.idempotencyRecord.create({
          data: {
            principalId,
            key: storageKey,
            httpStatus: 0,
            responseJson: {},
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const target = error.meta?.target;
          let isTargetMatch = true;
          if (target) {
            if (Array.isArray(target)) {
              isTargetMatch = target.includes('principalId') || target.includes('key');
            } else if (typeof target === 'string') {
              isTargetMatch = target.includes('principalId') || target.includes('key');
            } else {
              isTargetMatch = false;
            }
          }
          if (isTargetMatch) {
            throw new IdempotencyConflict(principalId, storageKey);
          }
        }
        throw error;
      }

      const r = await exec(tx);

      await tx.idempotencyRecord.update({
        where: {
          principalId_key: {
            principalId,
            key: storageKey,
          },
        },
        data: {
          httpStatus: r.status,
          responseJson: packStoredResponse(requestHash, r.body) as any,
        },
      });

      return r;
    });

    return { status: result.status, body: result.body, replayed: false };
  } catch (error) {
    if (error instanceof IdempotencyConflict) {
      const record = await prisma.idempotencyRecord.findUnique({
        where: {
          principalId_key: {
            principalId: error.principalId,
            key: error.key,
          },
        },
      });

      if (!record) {
        throw new Error('Broken invariant: idempotency record not found after conflict');
      }

      return {
        status: record.httpStatus,
        body: unpackStoredResponse(record.responseJson, requestHash),
        replayed: true,
      };
    }
    throw error;
  }
}
