import type {
  OverviewResponse,
  ChangeRequest,
  DiffItem,
  ProcedureOverview,
  FormVersionOverview,
  UsageSummary,
  ServiceUsage,
} from './types';

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') {
      return url.href;
    }
  } catch (_) {
    // Ignored
  }
  return null;
}

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

export function isBoundedString(v: unknown, maxLen: number): v is string {
  return typeof v === 'string' && v.length <= maxLen;
}

export function isNullableBoundedString(v: unknown, maxLen: number): v is string | null | undefined {
  if (v === null || v === undefined) return true;
  return typeof v === 'string' && v.length <= maxLen;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function parseOverview(body: unknown): OverviewResponse | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const obj = body as Record<string, unknown>;
  
  if (!Array.isArray(obj.procedures)) {
    return null;
  }
  if (obj.procedures.length > 500) {
    return null;
  }

  const parsedProcedures: ProcedureOverview[] = [];
  for (const proc of obj.procedures) {
    if (!proc || typeof proc !== 'object') {
      return null;
    }
    const p = proc as Record<string, unknown>;
    
    if (!isBoundedString(p.code, 500) || !isBoundedString(p.name, 500) || !isBoundedString(p.agency, 500) || !isBoundedString(p.sourceUrl, 2048) || !isBoundedString(p.lastCheckedAt, 500)) {
      return null;
    }

    let activeVersion: ProcedureOverview['activeVersion'] = null;
    if (p.activeVersion !== null && p.activeVersion !== undefined) {
      if (typeof p.activeVersion !== 'object') {
        return null;
      }
      const av = p.activeVersion as Record<string, unknown>;
      if (!isBoundedString(av.version, 32) || !/^[A-Za-z0-9._ -]{1,32}$/.test(av.version)) {
        return null;
      }
      if (!isNullableBoundedString(av.effectiveFrom, 500) || !isNullableBoundedString(av.effectiveTo, 500)) {
        return null;
      }
      activeVersion = {
        version: av.version,
        effectiveFrom: av.effectiveFrom ?? null,
        effectiveTo: av.effectiveTo ?? null,
      };
    }

    if (!Array.isArray(p.formVersions)) {
      return null;
    }
    if (p.formVersions.length > 500) {
      return null;
    }

    const parsedFormVersions: FormVersionOverview[] = [];
    for (const fv of p.formVersions) {
      if (!fv || typeof fv !== 'object') {
        return null;
      }
      const f = fv as Record<string, unknown>;
      if (!isBoundedString(f.version, 32) || !/^[A-Za-z0-9._ -]{1,32}$/.test(f.version)) {
        return null;
      }
      if (!isBoundedString(f.status, 32) || !/^[A-Z_]{1,32}$/.test(f.status)) {
        return null;
      }
      if (!isNullableBoundedString(f.effectiveFrom, 500) || !isNullableBoundedString(f.effectiveTo, 500)) {
        return null;
      }
      parsedFormVersions.push({
        version: f.version,
        status: f.status as any,
        effectiveFrom: f.effectiveFrom ?? null,
        effectiveTo: f.effectiveTo ?? null,
      });
    }

    parsedProcedures.push({
      code: p.code,
      name: p.name,
      agency: p.agency,
      sourceUrl: p.sourceUrl,
      lastCheckedAt: p.lastCheckedAt,
      activeVersion,
      formVersions: parsedFormVersions,
    });
  }

  const usage: UsageSummary = {};
  if (obj.usage && typeof obj.usage === 'object') {
    const u = obj.usage as Record<string, unknown>;
    for (const key of ['llm', 'stt', 'tts'] as const) {
      if (u[key] !== undefined && u[key] !== null) {
        if (typeof u[key] !== 'object') {
          return null;
        }
        const s = u[key] as Record<string, unknown>;
        if (!isFiniteNumber(s.calls) || !isFiniteNumber(s.avgLatencyMs) || !isFiniteNumber(s.estimatedCostUsd) || !isFiniteNumber(s.cacheHits) || !isFiniteNumber(s.degradedCount)) {
          return null;
        }
        
        let sTokens: number | undefined = undefined;
        if (s.tokens !== undefined && s.tokens !== null) {
          if (!isFiniteNumber(s.tokens)) return null;
          sTokens = s.tokens;
        }

        let sAudioSeconds: number | undefined = undefined;
        if (s.audioSeconds !== undefined && s.audioSeconds !== null) {
          if (!isFiniteNumber(s.audioSeconds)) return null;
          sAudioSeconds = s.audioSeconds;
        }

        usage[key] = {
          calls: s.calls,
          tokens: sTokens,
          audioSeconds: sAudioSeconds,
          avgLatencyMs: s.avgLatencyMs,
          estimatedCostUsd: s.estimatedCostUsd,
          cacheHits: s.cacheHits,
          degradedCount: s.degradedCount,
        };
      }
    }
  }

  return {
    procedures: parsedProcedures,
    usage,
  };
}

export function parseChangeRequests(body: unknown): ChangeRequest[] | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.changeRequests)) {
    return null;
  }
  if (obj.changeRequests.length > 500) {
    return null;
  }

  const parsedCRs: ChangeRequest[] = [];
  for (const cr of obj.changeRequests) {
    if (!cr || typeof cr !== 'object') {
      continue;
    }
    const c = cr as Record<string, unknown>;
    
    if (!isSafeId(c.id)) {
      continue;
    }
    if (!isBoundedString(c.status, 32) || !/^[A-Z_]{1,32}$/.test(c.status)) {
      continue;
    }
    if (!isBoundedString(c.sourceUrl, 2048)) {
      continue;
    }
    if (!isBoundedString(c.proposedTargetVersion, 32) || !/^[A-Za-z0-9._ -]{1,32}$/.test(c.proposedTargetVersion)) {
      continue;
    }
    if (!isBoundedString(c.createdAt, 500)) {
      continue;
    }
    if (!isNullableBoundedString(c.reviewedBy, 500) || !isNullableBoundedString(c.reviewedAt, 500)) {
      continue;
    }

    if (!c.oldVersion || typeof c.oldVersion !== 'object') {
      continue;
    }
    const ov = c.oldVersion as Record<string, unknown>;
    if (!isBoundedString(ov.formCode, 500) || !isBoundedString(ov.version, 32) || !/^[A-Za-z0-9._ -]{1,32}$/.test(ov.version)) {
      continue;
    }

    if (!c.diff || typeof c.diff !== 'object') {
      continue;
    }
    const d = c.diff as Record<string, unknown>;
    if (!isBoundedString(d.summary, 500)) {
      continue;
    }
    if (!Array.isArray(d.added) || !Array.isArray(d.removed) || !Array.isArray(d.changed)) {
      continue;
    }
    if (d.added.length > 500 || d.removed.length > 500 || d.changed.length > 500) {
      continue;
    }

    let addedValid = true;
    const parsedAdded: DiffItem[] = [];
    for (const item of d.added) {
      // The API serializes diff arrays as plain field-id strings; richer
      // {id, label} objects are also accepted.
      if (isBoundedString(item, 500)) { parsedAdded.push({ id: item, label: item }); continue; }
      if (!item || typeof item !== 'object') { addedValid = false; break; }
      const i = item as Record<string, unknown>;
      if (!isBoundedString(i.id, 500) || !isBoundedString(i.label, 500)) { addedValid = false; break; }
      parsedAdded.push({
        id: i.id,
        label: i.label,
      });
    }
    if (!addedValid) continue;

    let removedValid = true;
    const parsedRemoved: DiffItem[] = [];
    for (const item of d.removed) {
      if (isBoundedString(item, 500)) { parsedRemoved.push({ id: item, label: item }); continue; }
      if (!item || typeof item !== 'object') { removedValid = false; break; }
      const i = item as Record<string, unknown>;
      if (!isBoundedString(i.id, 500) || !isBoundedString(i.label, 500)) { removedValid = false; break; }
      parsedRemoved.push({
        id: i.id,
        label: i.label,
      });
    }
    if (!removedValid) continue;

    let changedValid = true;
    const parsedChanged: DiffItem[] = [];
    for (const item of d.changed) {
      if (isBoundedString(item, 500)) { parsedChanged.push({ id: item, label: item }); continue; }
      if (!item || typeof item !== 'object') { changedValid = false; break; }
      const i = item as Record<string, unknown>;
      if (!isBoundedString(i.id, 500) || !isBoundedString(i.label, 500)) { changedValid = false; break; }
      if (!isNullableBoundedString(i.oldLabel, 500) || !isNullableBoundedString(i.newLabel, 500)) { changedValid = false; break; }
      parsedChanged.push({
        id: i.id,
        label: i.label,
        oldLabel: i.oldLabel ?? undefined,
        newLabel: i.newLabel ?? undefined,
      });
    }
    if (!changedValid) continue;

    parsedCRs.push({
      id: c.id,
      status: c.status as any,
      sourceUrl: c.sourceUrl,
      diff: {
        summary: d.summary,
        added: parsedAdded,
        removed: parsedRemoved,
        changed: parsedChanged,
      },
      proposedTargetVersion: c.proposedTargetVersion,
      oldVersion: {
        formCode: ov.formCode,
        version: ov.version,
      },
      createdAt: c.createdAt,
      reviewedBy: c.reviewedBy ?? null,
      reviewedAt: c.reviewedAt ?? null,
    });
  }

  return parsedCRs;
}

export function errorMessageFor(status: number, code: string | null): string {
  if (status === 401) {
    return 'Sai mã quản trị';
  }
  if (status === 409) {
    if (code === 'ALREADY_PROCESSED') {
      return 'Đã xử lý trước đó';
    }
    if (code === 'CONCURRENT_UPDATE') {
      return 'Đang có thao tác khác, thử lại';
    }
  }
  if (status === 400) {
    if (code === 'INVALID_TARGET_VERSION') {
      return 'Phiên bản đích không hợp lệ';
    }
  }
  if (status === 429) {
    return 'Quá nhiều lần thử, chờ ít phút';
  }
  return 'Có lỗi xảy ra, vui lòng thử lại';
}

export const getErrorFromResponse = async (res: Response): Promise<{ status: number; code: string | null }> => {
  let code: string | null = null;
  try {
    const data = await res.json();
    if (data && data.error && typeof data.error.code === 'string') {
      code = data.error.code;
    }
  } catch (_) {
    // ignore
  }
  return { status: res.status, code };
};
