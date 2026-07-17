import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma, PrismaTx } from './db';

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

export function buildIdempotencyKey(parts: {
  operation: string;
  resourceId: string;
  sessionId?: string;
  messageId?: string;
  body?: unknown;
}): string | null {
  if (!parts.messageId) {
    return null;
  }
  const arrayToHash = [
    parts.operation,
    parts.resourceId,
    parts.sessionId ?? '',
    parts.messageId,
    parts.body ?? null,
  ];
  return sha256hex(canonicalJson(arrayToHash));
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

/**
 * Executes a database operation with exactly-once idempotency guarantees.
 * 
 * IMPORTANT: Callers MUST authenticate and authorize the principal before invoking this function.
 * Because lookups are scoped to the authenticated (principalId, key) pair, and the request's
 * principal is authorized before checking the database, returning the cached response
 * requires no further access control or revalidation checks.
 * 
 * @param principalId The server-derived authenticated principal (e.g. session user ID).
 * @param key The idempotency key, or null to bypass idempotency check.
 * @param exec The function performing database operations through the provided transaction client.
 */
export async function withIdempotency(
  principalId: string,
  key: string | null,
  exec: (tx: PrismaTx) => Promise<{ status: number; body: unknown }>
): Promise<{ status: number; body: unknown; replayed: boolean }> {
  if (typeof principalId !== 'string' || principalId.trim() === '') {
    throw new TypeError('principalId must be a non-empty string');
  }

  if (key === null) {
    const r = await prisma.$transaction(exec);
    return { ...r, replayed: false };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      try {
        await tx.idempotencyRecord.create({
          data: {
            principalId,
            key,
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
            throw new IdempotencyConflict(principalId, key);
          }
        }
        throw error;
      }

      const r = await exec(tx);

      await tx.idempotencyRecord.update({
        where: {
          principalId_key: {
            principalId,
            key,
          },
        },
        data: {
          httpStatus: r.status,
          responseJson: r.body as any,
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
        body: record.responseJson,
        replayed: true,
      };
    }
    throw error;
  }
}