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
  } else if (log.serviceType === 'stt') {
    if (modelLower.includes('whisper-1')) {
      return (log.audioSeconds ?? 0) * 0.0001; // $0.006 / 60 seconds
    }
  } else if (log.serviceType === 'tts') {
    if (modelLower.includes('tts-1-hd')) {
      const estimatedChars = (log.audioSeconds ?? 0) / 0.05;
      return estimatedChars * 0.000030; // $30 / 1M characters
    } else if (modelLower.includes('tts-1')) {
      const estimatedChars = (log.audioSeconds ?? 0) / 0.05;
      return estimatedChars * 0.000015; // $15 / 1M characters
    }
  }

  return 0;
}

/**
 * Aggregates all AI usage logs and returns a summary grouped by serviceType.
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const logs = await prisma.aiUsageLog.findMany();

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

  for (const log of logs) {
    const service = log.serviceType as 'llm' | 'stt' | 'tts';
    if (summary[service]) {
      const s = summary[service];
      s.calls++;
      s.tokens += (log.promptTokens ?? 0) + (log.completionTokens ?? 0);
      s.audioSeconds += log.audioSeconds ?? 0;
      serviceLatencies[service] += log.latencyMs;
      if (log.cacheHit) {
        s.cacheHits++;
      }
      if (log.degraded) {
        s.degradedCount++;
      }
      s.estimatedCostUsd += calculateLogCost(log);
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