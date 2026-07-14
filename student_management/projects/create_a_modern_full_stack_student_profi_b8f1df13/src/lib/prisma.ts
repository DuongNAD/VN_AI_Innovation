/**
 * Shared PrismaClient instance.
 *
 * Next.js dev mode re-executes modules on every hot reload (HMR). Creating a
 * new `PrismaClient` on each reload would open a fresh pool of database
 * connections every time and eventually exhaust the database's connection
 * limit. To avoid that, we cache a single client on `globalThis` and reuse it
 * across reloads.
 *
 * Exported as a NAMED export (`prisma`) so that route handlers can import it
 * and tests can substitute it with `vi.mock('@/lib/prisma')`.
 */
import { PrismaClient } from '@prisma/client';

// `globalThis` is not typed to hold our cached client, so we widen it with a
// narrow cast to an optional `prismaGlobal` slot.
const globalForPrisma = globalThis as unknown as {
  prismaGlobal?: PrismaClient;
};

/**
 * The single shared PrismaClient. Reuse the instance cached on `globalThis`
 * when present (surviving dev hot-reloads); otherwise create a new one.
 */
export const prisma: PrismaClient =
  globalForPrisma.prismaGlobal ?? new PrismaClient();

// In production each server process gets its own fresh client and never leaks
// onto the global object. In development we cache the instance so subsequent
// HMR reloads reuse it instead of opening new connection pools.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}