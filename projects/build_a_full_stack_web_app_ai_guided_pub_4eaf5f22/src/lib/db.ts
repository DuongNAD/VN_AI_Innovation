import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnecting: Promise<void> | undefined;
};

/**
 * Build DATABASE_URL with resilient pool settings for local Docker / Neon idle.
 * Prisma/Postgres driver supports connect_timeout & pool params on the URL.
 */
function resilientDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '10');
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '20');
    }
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '10');
    }
    // Keep TCP alive so idle local Docker sessions are less likely to drop.
    if (!u.searchParams.has('socket_timeout')) {
      u.searchParams.set('socket_timeout', '60');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient(): PrismaClient {
  const url = resilientDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(url
      ? {
          datasources: {
            db: { url },
          },
        }
      : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type PrismaTx = Prisma.TransactionClient;

/** True when the error looks like a transient DB connectivity failure. */
export function isDbConnectivityError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; name?: string; message?: string };
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();
  if (
    code === 'P1001' || // can't reach database
    code === 'P1002' || // timed out
    code === 'P1008' || // operations timed out
    code === 'P1017' || // server closed connection
    code === 'P2024' // timed out fetching connection from pool
  ) {
    return true;
  }
  return (
    msg.includes("can't reach database") ||
    msg.includes('cannot reach database') ||
    msg.includes('connection refused') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('connection timed out') ||
    msg.includes('server has closed the connection') ||
    msg.includes('connection terminated') ||
    msg.includes('too many connections')
  );
}

/**
 * Ensure the Prisma client has a live connection (reconnect after idle drop).
 */
export async function ensureDbConnected(): Promise<void> {
  if (globalForPrisma.prismaConnecting) {
    await globalForPrisma.prismaConnecting;
    return;
  }
  globalForPrisma.prismaConnecting = (async () => {
    try {
      await prisma.$connect();
      // Lightweight ping — also warms the pool after Docker wake.
      await prisma.$queryRaw`SELECT 1`;
    } finally {
      globalForPrisma.prismaConnecting = undefined;
    }
  })();
  await globalForPrisma.prismaConnecting;
}

/**
 * Run a DB operation with automatic reconnect + retries on connectivity errors.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; delayMs?: number; label?: string }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const delayMs = options?.delayMs ?? 400;
  const label = options?.label ?? 'db';

  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        try {
          await prisma.$disconnect().catch(() => undefined);
          await ensureDbConnected();
        } catch (reconnectErr) {
          console.warn(`[db] reconnect attempt ${attempt} failed (${label}):`, reconnectErr);
        }
      } else {
        // First attempt: soft connect without failing the op if already connected.
        await ensureDbConnected().catch(() => undefined);
      }
      return await operation();
    } catch (err) {
      lastErr = err;
      if (!isDbConnectivityError(err) || attempt === retries) {
        throw err;
      }
      console.warn(
        `[db] ${label} failed (attempt ${attempt}/${retries}), retrying…`,
        (err as Error)?.message ?? err
      );
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}
