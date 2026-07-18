/**
 * TTS pre-generation / durable-cache warming.
 *
 * Synthesizes the fixed, deterministic read-aloud text in the app (today: the
 * per-procedure checklist summary, in its base/no-conditional-answers form) and
 * stores it in the durable TtsCache, using the SAME cache key the synthesize
 * route computes. In 'fpt' mode the checklist page's read-aloud button then hits
 * a warm entry on first play — instant, and $0 upstream.
 *
 * Usage:
 *   npm run pregen:tts               # synthesize + warm every missing entry
 *   npm run pregen:tts -- --dry-run  # report what would be synthesized + est. cost, no writes
 *
 * Provider-aware: with AI_PROVIDER=mock (default) it warms free local mock audio
 * (useful to exercise the pipeline); with AI_PROVIDER=openai it calls the real
 * upstream once and is billed for it — preview the char/cost total with --dry-run.
 */
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { pruneAnswers } from '@/lib/intake-machine';
import { assembleGuidance } from '@/lib/guidance';
import { buildChecklistSummary } from '@/lib/checklist-summary';
import { getTtsProvider, getConfiguredTtsModel, makeSynthesisCacheKey } from '@/lib/ai/tts';
import { ttsCacheSet } from '@/lib/ai/tts-cache';
import { LIMITS } from '@/lib/constants';

const VOICE = 'vi-female';
const SPEED = 1;
const LANGUAGE = 'vi';

interface WarmItem {
  procedureCode: string;
  text: string;
  key: string;
}

/** Mirrors the per-character TTS pricing modeled in lib/ai/usage.ts. */
function estimateCostUsd(providerName: string, model: string, chars: number): number {
  if (providerName !== 'openai') return 0;
  const m = model.toLowerCase();
  if (m.includes('mock')) return 0;
  if (m.includes('tts-1-hd')) return chars * 0.00003;
  if (m.includes('tts-1')) return chars * 0.000015;
  if (m.includes('vits')) return chars * 0.0000165;
  return 0; // Unknown model: leave unmodeled rather than guess.
}

/** Builds the exact checklist-summary text the citizen UI would speak, per procedure. */
async function collectItems(): Promise<WarmItem[]> {
  const provider = getProvider();
  const overview = await provider.getCatalogOverview();
  const items: WarmItem[] = [];

  for (const proc of overview) {
    const code: string | undefined = (proc as any).code;
    if (!code) continue;

    const procedure = await provider.getProcedure(code);
    if (!procedure) continue;

    const procRow = await prisma.procedure.findUnique({ where: { code }, select: { id: true } });
    if (!procRow) continue;

    const procVersion = await provider.getActiveProcedureVersion(procRow.id);
    if (!procVersion) {
      // Guidance-only / no active version -> nothing to synthesize.
      continue;
    }

    const documents = await provider.getDocuments(procRow.id);
    const questions = await provider.getClarifyingQuestions(procRow.id);
    const activeForm = await provider.getActiveFormVersion(code);

    // Base case: no answers -> no conditional filtering. This matches the most
    // common first view; answer-specific variants warm lazily at runtime.
    const { answers } = pruneAnswers(questions, {});

    const guidance = assembleGuidance({
      procedure,
      procedureVersion: procVersion,
      documents,
      answers,
      questions,
      formAvailable: activeForm !== null,
    });

    const summary = buildChecklistSummary(guidance);
    if (!summary) continue;

    const text = summary.slice(0, LIMITS.TTS_CLIENT_MAX);
    const key = makeSynthesisCacheKey({ text, voice: VOICE, speed: SPEED, language: LANGUAGE });
    items.push({ procedureCode: code, text, key });
  }

  return items;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const providerName = getTtsProvider().name;
  const model = getConfiguredTtsModel(providerName);

  console.log(`[pregen-tts] provider=${providerName} model=${model} voice=${VOICE} ${dryRun ? '(DRY RUN)' : ''}`);

  const items = await collectItems();
  console.log(`[pregen-tts] ${items.length} candidate text(s) from the catalog.`);

  // Which keys are already durable? (findUnique, no audio load.)
  const existing = new Set(
    (
      await prisma.ttsCache.findMany({
        where: { key: { in: items.map((i) => i.key) } },
        select: { key: true },
      })
    ).map((r) => r.key)
  );

  const missing = items.filter((i) => !existing.has(i.key));
  const missingChars = missing.reduce((sum, i) => sum + i.text.length, 0);
  const estCost = estimateCostUsd(providerName, model, missingChars);

  console.log(
    `[pregen-tts] ${existing.size} already cached, ${missing.length} to synthesize ` +
      `(${missingChars} chars, est. ~$${estCost.toFixed(4)}).`
  );

  if (dryRun) {
    for (const i of missing) {
      console.log(`  would synthesize [${i.procedureCode}] ${i.text.length} chars`);
    }
    console.log('[pregen-tts] dry run complete — no audio synthesized or stored.');
    return;
  }

  let done = 0;
  let failed = 0;
  const tts = getTtsProvider();
  for (const item of missing) {
    try {
      const result = await tts.synthesize(item.text, VOICE, SPEED, LANGUAGE);
      await ttsCacheSet(item.key, {
        audio: result.audio,
        mimeType: result.mimeType,
        model: result.model,
      });
      done += 1;
      console.log(`  ✓ [${item.procedureCode}] warmed (${item.text.length} chars)`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ [${item.procedureCode}] failed:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[pregen-tts] done. synthesized=${done} skipped=${existing.size} failed=${failed}`);
}

main()
  .catch((err) => {
    console.error('[pregen-tts] fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
