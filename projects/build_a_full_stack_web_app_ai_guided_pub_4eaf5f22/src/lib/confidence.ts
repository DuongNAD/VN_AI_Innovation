export function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function confidencePercent(value: unknown): number {
  return Math.round(normalizeConfidence(value) * 100);
}

export function confidenceLevel(value: unknown): 'Rất phù hợp' | 'Phù hợp' | 'Cần kiểm tra' {
  const confidence = normalizeConfidence(value);
  if (confidence >= 0.9) return 'Rất phù hợp';
  if (confidence >= 0.75) return 'Phù hợp';
  return 'Cần kiểm tra';
}
