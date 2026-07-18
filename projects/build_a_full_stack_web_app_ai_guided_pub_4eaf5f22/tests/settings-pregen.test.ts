import { describe, it, expect, beforeAll } from 'vitest';

// DB-backed, like the other integration suites. Skipped by default so the plain
// `vitest run` is green without a database. To run it:
//   docker compose up -d db && npm run db:push && npm run db:seed
//   RUN_INTEGRATION=1 npx vitest run tests/settings-pregen.test.ts
const RUN = process.env.RUN_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('settings + TTS pre-generation (needs seeded DB)', () => {
  // Mock provider -> synthesis is free/local and keys are 'mock:mock-tts:*'.
  beforeAll(() => {
    process.env.AI_PROVIDER = 'mock';
  });

  it('persists and reads back the TTS mode, restoring the original', async () => {
    const { getTtsMode, setTtsMode } = await import('@/lib/settings');
    const original = await getTtsMode();
    try {
      await setTtsMode('fpt');
      expect(await getTtsMode()).toBe('fpt');
      await setTtsMode('browser');
      expect(await getTtsMode()).toBe('browser');
    } finally {
      await setTtsMode(original);
    }
  });

  it('pre-generated checklist audio is hit from L2 via the route-style key', async () => {
    const { getProvider } = await import('@/lib/data-provider');
    const { pruneAnswers } = await import('@/lib/intake-machine');
    const { assembleGuidance } = await import('@/lib/guidance');
    const { buildChecklistSummary } = await import('@/lib/checklist-summary');
    const { getTtsProvider, makeSynthesisCacheKey } = await import('@/lib/ai/tts');
    const { ttsCacheGet, ttsCacheSet } = await import('@/lib/ai/tts-cache');
    const { _resetCacheForTests } = await import('@/lib/cache');
    const { prisma } = await import('@/lib/db');
    const { LIMITS } = await import('@/lib/constants');

    // Reproduce, offline, what the CLI warms and what the checklist page speaks.
    const overview = await getProvider().getCatalogOverview();
    const code = (overview[0] as any).code as string;
    const procedure = await getProvider().getProcedure(code);
    const procRow = await prisma.procedure.findUnique({ where: { code }, select: { id: true } });
    const procVersion = await getProvider().getActiveProcedureVersion(procRow!.id);
    expect(procVersion).not.toBeNull();
    const documents = await getProvider().getDocuments(procRow!.id);
    const questions = await getProvider().getClarifyingQuestions(procRow!.id);
    const activeForm = await getProvider().getActiveFormVersion(code);
    const { answers } = pruneAnswers(questions, {});

    const guidance = assembleGuidance({
      procedure: procedure!,
      procedureVersion: procVersion!,
      documents,
      answers,
      questions,
      formAvailable: activeForm !== null,
    });
    const summary = buildChecklistSummary(guidance);
    expect(summary.length).toBeGreaterThan(0);

    const text = summary.slice(0, LIMITS.TTS_CLIENT_MAX);
    const key = makeSynthesisCacheKey({ text, voice: 'vi-female', speed: 1, language: 'vi' });

    // Warm exactly as prisma/pregen-tts.ts does.
    const result = await getTtsProvider().synthesize(text, 'vi-female', 1, 'vi');
    await ttsCacheSet(key, { audio: result.audio, mimeType: result.mimeType, model: result.model });

    try {
      // Fresh instance / after restart: L1 empty. The route recomputes the key
      // (same helper) and must hit the durable, pre-warmed row.
      _resetCacheForTests();
      const routeKey = makeSynthesisCacheKey({ text, voice: 'vi-female', speed: 1, language: 'vi' });
      expect(routeKey).toBe(key);

      const hit = await ttsCacheGet(routeKey);
      expect(hit?.tier).toBe('l2');
      expect(hit?.audio.byteLength).toBe(result.audio.byteLength);
    } finally {
      await prisma.ttsCache.delete({ where: { key } }).catch(() => {});
    }
  });
});
