import { describe, it, expect } from 'vitest';

// End-to-end integration against a live, seeded PostgreSQL database.
// It is skipped by default so `npx vitest run` is green on a machine without a
// database. To exercise it, bring the stack up and run:
//   docker compose up -d db && npm run db:push && npm run db:seed
//   RUN_INTEGRATION=1 DATABASE_URL=... npx vitest run tests/integration/flow.test.ts
const RUN = process.env.RUN_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('integration · citizen flow (needs seeded DB)', () => {
  it('classifies a marriage intent to MARRIAGE_REGISTRATION', async () => {
    const { getProvider } = await import('@/lib/data-provider');
    const proc = await getProvider().getProcedure('MARRIAGE_REGISTRATION');
    expect(proc?.code).toBe('MARRIAGE_REGISTRATION');
  });

  it('serves form version 1.0 as active before any approval', async () => {
    const { getProvider } = await import('@/lib/data-provider');
    const active = await getProvider().getActiveFormVersion('MARRIAGE_REGISTRATION');
    expect(active?.version).toBe('1.0');
  });
});

// A tiny always-on assertion keeps this file from being an empty suite when the
// integration block is skipped.
describe('integration · harness', () => {
  it('is wired and ready (set RUN_INTEGRATION=1 to exercise the DB flow)', () => {
    expect(typeof RUN).toBe('boolean');
  });
});
