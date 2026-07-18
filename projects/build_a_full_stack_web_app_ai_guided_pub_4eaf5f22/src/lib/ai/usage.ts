import { prisma } from '@/lib/db';

export interface ServiceUsage {
  calls: number;
  tokens: number;
  audioSeconds: number;
  avgLatencyMs: number;
  cacheHits: number;
  degradedCount: number;
  estimatedCostUsd: number;
}

export interface UsageSummary {
  llm: ServiceUsage;
  stt: ServiceUsage;
  tts: ServiceUsage;
}

/**
 * Fire-and-forget logger for AI service usage.
 * Errors are caught and logged to console to prevent request failure.
 */
export function logAiUsage(entry: {
  serviceType: 'llm' | 'stt' | 'tts';
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  audioSeconds?: number;
  latencyMs: number;
  cacheHit?: boolean;
  degraded?: boolean;
}): void {
  prisma.aiUsageLog.create({
    data: {
      serviceType: entry.serviceType,
      model: entry.model,
      promptTokens: entry.promptTokens ?? null,
      completionTokens: entry.completionTokens ?? null,
      audioSeconds: entry.audioSeconds ?? null,
      latencyMs: entry.latencyMs,
      cacheHit: entry.cacheHit ?? false,
      degraded: entry.degraded ?? false,
    },
  }).catch((err) => {
    console.error('Failed to log AI usage:', err);
  });
}

/**
 * Calculates estimated cost in USD based on model pricing rules.
 */
function calculateLogCost(log: {
  serviceType: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  audioSeconds: number | null;
  cacheHit: boolean;
}): number {
  if (log.cacheHit) {
    return 0;
  }
  const modelLower = log.model.toLowerCase();
  if (modelLower.startsWith('mock') || modelLower.includes('mock')) {
    return 0;
  }

  if (log.serviceType === 'llm') {
    if (modelLower.includes('gpt-4o-mini')) {
      const promptCost = (log.promptTokens ?? 0) * 0.00000015; // $0.15 / 1M tokens
      const completionCost = (log.completionTokens ?? 0) * 0.00000060; // $0.60 / 1M tokens
      return promptCost + completionCost;
    }
    if (modelLower.includes('deepseek-v4-flash')) {
      // FPT AI Marketplace listed rates: $0.14 / $0.28 per 1M tokens
      const promptCost = (log.promptTokens ?? 0) * 0.00000014;
      const completionCost = (log.completionTokens ?? 0) * 0.00000028;
      return promptCost + completionCost;
    }
  } else if (log.serviceType === 'stt') {
    if (modelLower.includes('whisper-1')) {
      return (log.audioSeconds ?? 0) * 0.0001; // $0.006 / 60 seconds
    }
    // FPT.AI-whisper-* rates are not published per second; left unmodeled (0).
  } else if (log.serviceType === 'tts') {
    if (modelLower.includes('tts-1-hd')) {
      const estimatedChars = (log.audioSeconds ?? 0) / 0.05;
      return estimatedChars * 0.000030; // $30 / 1M characters
    } else if (modelLower.includes('tts-1')) {
      const estimatedChars = (log.audioSeconds ?? 0) / 0.05;
      return estimatedChars * 0.000015; // $15 / 1M characters
    } else if (modelLower.includes('vits')) {
      // FPT.AI-VITs marketplace rate $16.5 / 1M input tokens, approximated as characters.
      const estimatedChars = (log.audioSeconds ?? 0) / 0.05;
      return estimatedChars * 0.0000165;
    }
  }

  return 0;
}

/**
 * Aggregates AI usage in PostgreSQL and returns a summary grouped by serviceType.
 * The number of rows returned is bounded by distinct service/model/cache/degraded
 * combinations rather than growing with the full event history.
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const groups = await prisma.aiUsageLog.groupBy({
    by: ['serviceType', 'model', 'cacheHit', 'degraded'],
    _count: { _all: true },
    _sum: {
      promptTokens: true,
      completionTokens: true,
      audioSeconds: true,
      latencyMs: true,
    },
  });

  const summary: UsageSummary = {
    llm: {
      calls: 0,
      tokens: 0,
      audioSeconds: 0,
      avgLatencyMs: 0,
      cacheHits: 0,
      degradedCount: 0,
      estimatedCostUsd: 0,
    },
    stt: {
      calls: 0,
      tokens: 0,
      audioSeconds: 0,
      avgLatencyMs: 0,
      cacheHits: 0,
      degradedCount: 0,
      estimatedCostUsd: 0,
    },
    tts: {
      calls: 0,
      tokens: 0,
      audioSeconds: 0,
      avgLatencyMs: 0,
      cacheHits: 0,
      degradedCount: 0,
      estimatedCostUsd: 0,
    },
  };

  const serviceLatencies: Record<'llm' | 'stt' | 'tts', number> = {
    llm: 0,
    stt: 0,
    tts: 0,
  };

  for (const group of groups) {
    const service = group.serviceType as 'llm' | 'stt' | 'tts';
    if (service === 'llm' || service === 'stt' || service === 'tts') {
      const calls = group._count._all;
      const s = summary[service];
      const promptTokens = group._sum.promptTokens ?? 0;
      const completionTokens = group._sum.completionTokens ?? 0;
      const audioSeconds = group._sum.audioSeconds ?? 0;
      const latencyMs = group._sum.latencyMs ?? 0;

      s.calls += calls;
      s.tokens += promptTokens + completionTokens;
      s.audioSeconds += audioSeconds;
      serviceLatencies[service] += latencyMs;
      if (group.cacheHit) {
        s.cacheHits += calls;
      }
      if (group.degraded) {
        s.degradedCount += calls;
      }
      s.estimatedCostUsd += calculateLogCost({
        serviceType: group.serviceType,
        model: group.model,
        promptTokens,
        completionTokens,
        audioSeconds,
        cacheHit: group.cacheHit,
      });
    }
  }

  for (const service of ['llm', 'stt', 'tts'] as const) {
    const s = summary[service];
    if (s.calls > 0) {
      s.avgLatencyMs = Math.round(serviceLatencies[service] / s.calls);
    }
  }

  return summary;
}
