'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { DocumentTypeBadge } from '@/components/DocumentTypeSelect';
import type { FieldDef } from '@/lib/schema-guards';
import {
  DOCUMENT_TYPE_CODES,
  DOCUMENT_TYPES,
  getDocumentTypeMeta,
  inferDocumentType,
  isDocumentTypeCode,
  type DocumentTypeCode,
} from '@/lib/document-types';
import {
  canApproveChangeRequests,
  canReviewApplications,
  type StaffRole,
} from '@/lib/roles';
import { DEFAULT_TTS_MODE, isTtsMode, type TtsMode } from '@/lib/tts-mode';

interface FormVersionOverview {
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

interface ProcedureOverview {
  code: string;
  name: string;
  agency: string;
  sourceUrl: string;
  lastCheckedAt: string;
  activeVersion: {
    version: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
  } | null;
  formVersions: FormVersionOverview[];
}

interface ServiceUsage {
  calls: number;
  tokens?: number;
  audioSeconds?: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  cacheHits: number;
  degradedCount: number;
}

interface UsageSummary {
  llm?: ServiceUsage;
  stt?: ServiceUsage;
  tts?: ServiceUsage;
}

interface OverviewResponse {
  procedures: ProcedureOverview[];
  usage: UsageSummary;
  ttsMode: TtsMode;
}

interface DiffItem {
  id: string;
  label: string;
  oldLabel?: string;
  newLabel?: string;
}

interface ChangeRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  sourceUrl: string;
  diff: {
    summary: string;
    added: DiffItem[];
    removed: DiffItem[];
    changed: DiffItem[];
  };
  proposedTargetVersion: string;
  oldVersion: {
    formCode: string;
    version: string;
  };
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

interface ApprovalResult {
  changeRequestId: string;
  status: string;
  formCode: string;
  activatedVersion: string;
  closedVersion: string | null;
  effectiveFrom: string;
}

interface CitizenApplication {
  id: string;
  status: 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  formCode: string;
  formVersion: string;
  procedureName: string;
  documentType: DocumentTypeCode;
  documentTypeLabel: string;
  documentTypeIcon: string;
  data: Record<string, unknown>;
  fields: FieldDef[];
}

interface DocumentTypeStat {
  code: DocumentTypeCode;
  label: string;
  icon: string;
  total: number;
  submitted: number;
  approved: number;
  returned: number;
}

interface ApplicationQueueStats {
  total: number;
  submitted: number;
  approved: number;
  returned: number;
  byType: DocumentTypeStat[];
}

// Module-private pure helpers
function safeHttpsUrl(value: unknown): string | null {
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

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function isBoundedString(v: unknown, maxLen: number): v is string {
  return typeof v === 'string' && v.length <= maxLen;
}

function isNullableBoundedString(v: unknown, maxLen: number): v is string | null | undefined {
  if (v === null || v === undefined) return true;
  return typeof v === 'string' && v.length <= maxLen;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function parseOverview(body: unknown): OverviewResponse | null {
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
    const usageEnvelope = obj.usage as Record<string, unknown>;
    if (!usageEnvelope.services || typeof usageEnvelope.services !== 'object') {
      return null;
    }
    const u = usageEnvelope.services as Record<string, unknown>;
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

  let ttsMode: TtsMode = DEFAULT_TTS_MODE;
  if (obj.settings && typeof obj.settings === 'object') {
    const s = obj.settings as Record<string, unknown>;
    if (isTtsMode(s.ttsMode)) {
      ttsMode = s.ttsMode;
    }
  }

  return {
    procedures: parsedProcedures,
    usage,
    ttsMode,
  };
}

function parseChangeRequests(body: unknown): ChangeRequest[] | null {
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

/**
 * Officer-queue payload: keep ids/statuses strictly validated, pass the field
 * schema through loosely — it comes from our own provider and is only used
 * to label values for display.
 */
function parseApplicationQueueStats(body: unknown): ApplicationQueueStats | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (!obj.stats || typeof obj.stats !== 'object') {
    // Older payload without stats — synthesize empty.
    return {
      total: 0,
      submitted: 0,
      approved: 0,
      returned: 0,
      byType: DOCUMENT_TYPE_CODES.map((code) => {
        const meta = getDocumentTypeMeta(code);
        return { code, label: meta.label, icon: meta.icon, total: 0, submitted: 0, approved: 0, returned: 0 };
      }),
    };
  }
  const s = obj.stats as Record<string, unknown>;
  if (
    !isFiniteNumber(s.total) ||
    !isFiniteNumber(s.submitted) ||
    !isFiniteNumber(s.approved) ||
    !isFiniteNumber(s.returned) ||
    !Array.isArray(s.byType)
  ) {
    return null;
  }
  const byType: DocumentTypeStat[] = [];
  for (const row of s.byType) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!isDocumentTypeCode(r.code)) continue;
    if (
      !isBoundedString(r.label, 200) ||
      !isBoundedString(r.icon, 16) ||
      !isFiniteNumber(r.total) ||
      !isFiniteNumber(r.submitted) ||
      !isFiniteNumber(r.approved) ||
      !isFiniteNumber(r.returned)
    ) {
      continue;
    }
    byType.push({
      code: r.code,
      label: r.label,
      icon: r.icon,
      total: r.total,
      submitted: r.submitted,
      approved: r.approved,
      returned: r.returned,
    });
  }
  // Ensure every catalog code appears (stable UI order).
  const map = new Map(byType.map((x) => [x.code, x]));
  const ordered = DOCUMENT_TYPE_CODES.map((code) => {
    const existing = map.get(code);
    if (existing) return existing;
    const meta = getDocumentTypeMeta(code);
    return { code, label: meta.label, icon: meta.icon, total: 0, submitted: 0, approved: 0, returned: 0 };
  });
  return {
    total: s.total,
    submitted: s.submitted,
    approved: s.approved,
    returned: s.returned,
    byType: ordered,
  };
}

function parseCitizenApplications(body: unknown): CitizenApplication[] | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.applications) || obj.applications.length > 500) {
    return null;
  }

  const parsed: CitizenApplication[] = [];
  for (const raw of obj.applications) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const a = raw as Record<string, unknown>;
    if (!isSafeId(a.id)) {
      continue;
    }
    if (a.status !== 'SUBMITTED' && a.status !== 'APPROVED' && a.status !== 'RETURNED') {
      continue;
    }
    if (!isBoundedString(a.formCode, 500) || !isBoundedString(a.procedureName, 500)) {
      continue;
    }
    if (!isBoundedString(a.formVersion, 32) || !/^[A-Za-z0-9._ -]{1,32}$/.test(a.formVersion)) {
      continue;
    }
    if (
      !isNullableBoundedString(a.submittedAt, 500) ||
      !isNullableBoundedString(a.reviewedAt, 500) ||
      !isNullableBoundedString(a.reviewedBy, 500) ||
      !isNullableBoundedString(a.reviewNote, 2000)
    ) {
      continue;
    }
    const documentType = isDocumentTypeCode(a.documentType)
      ? a.documentType
      : inferDocumentType(a.formCode);
    const meta = getDocumentTypeMeta(documentType);
    const data = a.data && typeof a.data === 'object' && !Array.isArray(a.data)
      ? (a.data as Record<string, unknown>)
      : {};
    const fields: FieldDef[] = [];
    if (Array.isArray(a.fields) && a.fields.length <= 500) {
      for (const f of a.fields) {
        if (f && typeof f === 'object' && isBoundedString((f as any).id, 500) && isBoundedString((f as any).label, 500)) {
          fields.push(f as FieldDef);
        }
      }
    }
    parsed.push({
      id: a.id,
      status: a.status,
      submittedAt: a.submittedAt ?? null,
      reviewedAt: a.reviewedAt ?? null,
      reviewedBy: a.reviewedBy ?? null,
      reviewNote: a.reviewNote ?? null,
      formCode: a.formCode,
      formVersion: a.formVersion,
      procedureName: a.procedureName,
      documentType,
      documentTypeLabel: isBoundedString(a.documentTypeLabel, 200) ? a.documentTypeLabel : meta.label,
      documentTypeIcon: isBoundedString(a.documentTypeIcon, 16) ? a.documentTypeIcon : meta.icon,
      data,
      fields,
    });
  }
  return parsed;
}

function errorMessageFor(status: number, code: string | null): string {
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
    if (code === 'NOTE_REQUIRED') {
      return 'Vui lòng nhập lý do trả lại để người dân biết cần bổ sung gì';
    }
  }
  if (status === 422 && code === 'VALIDATION_FAILED') {
    return 'Hồ sơ còn lỗi theo quy định nên không thể phê duyệt';
  }
  if (status === 429) {
    return 'Quá nhiều lần thử, chờ ít phút';
  }
  return 'Có lỗi xảy ra, vui lòng thử lại';
}

const getErrorFromResponse = async (res: Response): Promise<{ status: number; code: string | null }> => {
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

export type StaffConsoleRole = StaffRole;

export interface StaffConsoleProps {
  /**
   * manager — xét duyệt hồ sơ công dân (duyệt đơn), xem overview + change requests
   *           (không phê duyệt phiên bản biểu mẫu, không đổi cài đặt)
   * admin — đầy đủ quyền, gồm phê duyệt & kích hoạt phiên bản
   */
  role?: StaffConsoleRole;
}

export default function AdminConsole({ role = 'admin' }: StaffConsoleProps): ReactElement {
  // Duyệt đơn (hồ sơ công dân): manager + admin
  const canReviewApps = canReviewApplications(role);
  // Phê duyệt change request / cài đặt TTS: chỉ admin
  const canApproveActions = canApproveChangeRequests(role);
  const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Người quản lý';
  const portalHome = role === 'admin' ? '/admin' : '/manager';

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [approvalResults, setApprovalResults] = useState<Record<string, ApprovalResult>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [citizenApps, setCitizenApps] = useState<CitizenApplication[]>([]);
  const [appStats, setAppStats] = useState<ApplicationQueueStats | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<DocumentTypeCode | 'ALL'>('ALL');
  // Default: show pending queue first (CHỜ DUYỆT)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'APPROVED' | 'RETURNED'>('SUBMITTED');
  const [ttsMode, setTtsMode] = useState<TtsMode>(DEFAULT_TTS_MODE);
  const [savingTtsMode, setSavingTtsMode] = useState<boolean>(false);

  const handleFetchData = async (opts?: { silent?: boolean }) => {
    setLoading(true);
    setError(null);
    if (!opts?.silent) {
      setSuccess(null);
    }

    try {
      // Citizen queue is staff-wide (manager + admin) — only form-version
      // change requests and settings stay admin-only.
      const appsQuery = new URLSearchParams();
      // Always load full queue for client-side filter + stable stats; server
      // still returns stats for the whole officer queue.
      appsQuery.set('documentType', 'ALL');
      appsQuery.set('status', 'ALL');
      const [overviewRes, crRes, appsRes] = await Promise.all([
        fetch('/api/v1/admin/overview', {
          credentials: 'include',
        }),
        fetch('/api/v1/admin/change-requests', {
          credentials: 'include',
        }),
        fetch(`/api/v1/admin/applications?${appsQuery.toString()}`, {
          credentials: 'include',
        }),
      ]);

      if (!overviewRes.ok) {
        const { status, code } = await getErrorFromResponse(overviewRes);
        throw new Error(errorMessageFor(status, code));
      }
      if (!crRes.ok) {
        const { status, code } = await getErrorFromResponse(crRes);
        throw new Error(errorMessageFor(status, code));
      }
      if (!appsRes.ok) {
        const { status, code } = await getErrorFromResponse(appsRes);
        throw new Error(errorMessageFor(status, code));
      }

      let rawOverview: unknown;
      let rawCRs: unknown;
      let rawApps: unknown;
      try {
        rawOverview = await overviewRes.json();
        rawCRs = await crRes.json();
        rawApps = await appsRes.json();
      } catch (_) {
        throw new Error(errorMessageFor(500, 'JSON_PARSE_FAILURE'));
      }

      const parsedOverview = parseOverview(rawOverview);
      const parsedCRs = parseChangeRequests(rawCRs);
      const parsedApps = parseCitizenApplications(rawApps);
      const parsedStats = parseApplicationQueueStats(rawApps);

      if (parsedOverview === null || parsedCRs === null || parsedApps === null || parsedStats === null) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      setOverview(parsedOverview);
      setChangeRequests(parsedCRs);
      setCitizenApps(parsedApps);
      setAppStats(parsedStats);
      setTtsMode(parsedOverview.ttsMode);

      if (rawOverview && typeof rawOverview === 'object') {
        const actor = (rawOverview as Record<string, unknown>).actor;
        if (actor && typeof actor === 'object') {
          const dn = (actor as Record<string, unknown>).displayName;
          if (typeof dn === 'string') setActorName(dn);
        }
      }

      if (!opts?.silent) {
        setSuccess(
          role === 'admin'
            ? 'Tải dữ liệu quản trị thành công.'
            : 'Tải dữ liệu manager thành công — có thể duyệt / trả lại hồ sơ công dân.'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleSetTtsMode = async (mode: TtsMode) => {
    if (mode === ttsMode || savingTtsMode) {
      return;
    }
    setSavingTtsMode(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttsMode: mode }),
      });

      if (!res.ok) {
        const { status, code } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code));
      }

      setTtsMode(mode);
      setSuccess(
        mode === 'fpt'
          ? 'Đã chuyển sang giọng đọc FPT (chất lượng cao) cho toàn hệ thống.'
          : 'Đã chuyển sang giọng trình duyệt (miễn phí); tự dùng FPT khi thiết bị không hỗ trợ.'
      );
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSavingTtsMode(false);
    }
  };

  useEffect(() => {
    void handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Flash toast after returning from detail approve/return (?flash=approved|returned)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const flash = url.searchParams.get('flash');
    if (flash === 'approved') {
      setSuccess('Đã phê duyệt hồ sơ thành công');
      setStatusFilter('SUBMITTED');
    } else if (flash === 'returned') {
      setSuccess('Đã trả lại hồ sơ để người dân bổ sung');
      setStatusFilter('SUBMITTED');
    } else {
      return;
    }
    url.searchParams.delete('flash');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));
    void handleFetchData({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const filteredCitizenApps = useMemo(() => {
    return citizenApps.filter((app) => {
      if (docTypeFilter !== 'ALL' && app.documentType !== docTypeFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && app.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [citizenApps, docTypeFilter, statusFilter]);

  const handleApprove = async (id: string) => {
    if (!isSafeId(id)) {
      setError('Mã yêu cầu không hợp lệ.');
      return;
    }

    setApprovingId(id);
    setError(null);
    setSuccess(null);

    try {
      if (!canApproveActions) {
        setError('Chỉ quản trị viên mới được phê duyệt yêu cầu thay đổi.');
        setApprovingId(null);
        return;
      }

      const res = await fetch(`/api/v1/admin/change-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const { status, code } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code));
      }

      let rawResult: unknown;
      try {
        rawResult = await res.json();
      } catch (_) {
        throw new Error(errorMessageFor(500, 'JSON_PARSE_FAILURE'));
      }

      if (!rawResult || typeof rawResult !== 'object') {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      const resultObj = rawResult as Record<string, unknown>;
      const changeRequestId = resultObj.changeRequestId;
      const status = resultObj.status;
      const formCode = resultObj.formCode;
      const activatedVersion = resultObj.activatedVersion;
      const closedVersion = resultObj.closedVersion;
      const effectiveFrom = resultObj.effectiveFrom;

      if (!isBoundedString(changeRequestId, 500) || !isBoundedString(status, 500) || !isBoundedString(formCode, 500) || !isBoundedString(effectiveFrom, 500)) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      if (typeof activatedVersion !== 'string' || (closedVersion !== null && closedVersion !== undefined && typeof closedVersion !== 'string')) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      const approvalResult: ApprovalResult = {
        changeRequestId,
        status,
        formCode,
        activatedVersion,
        closedVersion: (closedVersion as string | null) ?? null,
        effectiveFrom,
      };

      setApprovalResults(prev => ({ ...prev, [id]: approvalResult }));

      const versionRegex = /^[A-Za-z0-9._ -]{1,32}$/;
      const isActivatedVersionValid = versionRegex.test(activatedVersion);
      const isClosedVersionValid = closedVersion === null || closedVersion === undefined || versionRegex.test(closedVersion as string);

      if (isActivatedVersionValid && isClosedVersionValid) {
        if (closedVersion) {
          setSuccess(`Kích hoạt thành công phiên bản ${activatedVersion} (đóng phiên bản ${closedVersion}).`);
        } else {
          setSuccess(`Kích hoạt thành công phiên bản ${activatedVersion}.`);
        }
      } else {
        setSuccess('Đã phê duyệt & kích hoạt thành công');
      }

      await handleFetchData({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setApprovingId(null);
    }
  };

  const formatDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return '—';
    }
  };

  const versionRegex = /^[A-Za-z0-9._ -]{1,32}$/;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800">
      <div className="card border border-slate-100 bg-slate-900 text-white shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-amber-400">
              Bảng điều khiển {roleLabel}
            </h2>
            <p className="text-sm text-slate-300">
              {canApproveActions
                ? 'Phiên đăng nhập cookie — duyệt hồ sơ công dân, quan trắc AI và phê duyệt thay đổi biểu mẫu.'
                : 'Phiên đăng nhập cookie — duyệt hồ sơ công dân (APPROVE/RETURN), xem danh mục thủ tục, quan trắc AI và yêu cầu thay đổi.'}
            </p>
            <p className="text-xs text-slate-400">
              Vai trò: <span className="font-semibold text-amber-300">{role}</span>
              {actorName ? (
                <>
                  {' '}
                  · Phiên: <span className="text-slate-200">{actorName}</span>
                </>
              ) : null}
              {canReviewApps && ' · được duyệt đơn'}
              {!canApproveActions && ' · không phê duyệt phiên bản biểu mẫu'}
            </p>
          </div>
          <button
            onClick={() => handleFetchData()}
            disabled={loading}
            className="btn bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 font-semibold"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Đang tải...
              </div>
            ) : (
              'Làm mới dữ liệu'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <h4 className="font-semibold">Đã xảy ra lỗi</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3">
          <span className="text-lg">✅</span>
          <div>
            <h4 className="font-semibold">Thông báo</h4>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card space-y-4 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Danh mục Thủ tục & Biểu mẫu</h3>
              <p className="text-sm text-slate-500">
                Trạng thái hoạt động của các phiên bản biểu mẫu số hóa được cấu hình trong hệ thống.
              </p>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Thủ tục (Mã)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Phiên bản</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Hiệu lực từ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Hết hiệu lực</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {overview.procedures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                        Không có thủ tục nào được tìm thấy.
                      </td>
                    </tr>
                  ) : (
                    overview.procedures.flatMap((proc) => {
                      const versions = proc.formVersions;
                      if (versions.length === 0) {
                        return [
                          <tr key={proc.code} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-950 border-r border-slate-100">
                              <div>{proc.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{proc.code}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-500" colSpan={4}>
                              Hướng dẫn (Chỉ tra cứu thông tin)
                            </td>
                          </tr>
                        ];
                      }
                      return versions.map((ver, idx) => (
                        <tr key={`${proc.code}-${ver.version}`} className="hover:bg-slate-50">
                          {idx === 0 ? (
                            <td
                              className="px-4 py-3 font-medium text-slate-950 border-r border-slate-100"
                              rowSpan={versions.length}
                            >
                              <div>{proc.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{proc.code}</div>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-semibold font-mono text-slate-700">{ver.version}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                                ver.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : ver.status === 'DRAFT'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              {ver.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : ver.status === 'DRAFT' ? 'BẢN NHÁP' : 'ĐÃ ĐÓNG'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatDate(ver.effectiveFrom)}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatDate(ver.effectiveTo)}</td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card space-y-4 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Quan trắc Sử dụng Trí tuệ Nhân tạo (AI)</h3>
              <p className="text-sm text-slate-500">
                Thống kê hiệu năng, lưu lượng, tỷ lệ cache và ước tính chi phí tích lũy theo từng phân hệ.
              </p>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600">Phân hệ</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Cuộc gọi</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Đơn vị AI</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Trễ TB</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Cache Hit</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Mất kết nối</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Chi phí (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {!overview.usage || (['llm', 'stt', 'tts'] as const).every(key => !overview.usage[key]) ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400 italic">
                        Không có dữ liệu sử dụng AI.
                      </td>
                    </tr>
                  ) : (
                    (['llm', 'stt', 'tts'] as const).map((service) => {
                      const usageData = overview.usage[service];
                      if (!usageData) return null;
                      let serviceName = '';
                      let aiUnit = '—';

                      if (service === 'llm') {
                        serviceName = 'Trợ lý (LLM)';
                        aiUnit = usageData.tokens ? `${usageData.tokens.toLocaleString()} tkn` : '—';
                      } else if (service === 'stt') {
                        serviceName = 'Nhận dạng giọng nói (STT)';
                        aiUnit = usageData.audioSeconds ? `${usageData.audioSeconds.toFixed(1)} giây` : '—';
                      } else if (service === 'tts') {
                        serviceName = 'Chuyển đổi âm thanh (TTS)';
                        aiUnit = '—';
                      }

                      return (
                        <tr key={service} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-900">{serviceName}</td>
                          <td className="px-3 py-3 text-right font-mono font-medium">{usageData.calls}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">{aiUnit}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">
                            {usageData.avgLatencyMs ? `${usageData.avgLatencyMs.toLocaleString()}ms` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">{usageData.cacheHits}</td>
                          <td className="px-3 py-3 text-right font-mono text-rose-600 font-semibold">{usageData.degradedCount}</td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-700 font-bold">
                            ${usageData.estimatedCostUsd ? usageData.estimatedCostUsd.toFixed(4) : '0.0000'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {overview && canApproveActions && (
        <div className="card space-y-4 border border-slate-100 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Chế độ đọc nội dung (Text-to-Speech)</h3>
            <p className="text-sm text-slate-500">
              Chọn cách hệ thống đọc nội dung cho người dân. Giọng FPT chất lượng cao hơn nhưng tính phí
              theo ký tự — chi phí cho nội dung lặp lại được giảm gần như bằng 0 nhờ bộ nhớ đệm bền vững.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['browser', 'fpt'] as const).map((mode) => {
              const active = ttsMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSetTtsMode(mode)}
                  disabled={savingTtsMode}
                  aria-pressed={active}
                  className={`text-left rounded-xl border p-4 transition-all disabled:opacity-60 ${
                    active
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {mode === 'browser' ? '🌐 Trình duyệt (miễn phí)' : '⭐ Giọng FPT (cao cấp)'}
                    </span>
                    {active && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                        ĐANG DÙNG
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {mode === 'browser'
                      ? 'Đọc bằng giọng có sẵn của trình duyệt. Thiết bị không hỗ trợ sẽ tự chuyển sang giọng FPT.'
                      : 'Luôn đọc bằng giọng FPT chất lượng cao. Nội dung lặp lại phát từ cache, gần như $0.'}
                  </p>
                </button>
              );
            })}
          </div>
          {savingTtsMode && <p className="text-xs text-slate-400">Đang lưu thay đổi…</p>}
        </div>
      )}

      {overview && (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-xl font-bold text-slate-900">
              Hồ sơ công dân chờ xét duyệt
              {canReviewApps ? (
                <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  {role === 'manager' ? 'Manager được duyệt đơn' : 'Admin được duyệt đơn'}
                </span>
              ) : null}
            </h3>
            <p className="text-sm text-slate-500">
              Hồ sơ người dân đã kiểm tra hợp lệ và nộp trực tuyến — phân loại theo loại đơn.
              {canReviewApps
                ? ' Phê duyệt hoặc trả lại kèm lý do — kết quả hiển thị ngay trên trang trạng thái của người dân.'
                : ' Chỉ xem — không có quyền quyết định trên hồ sơ.'}
            </p>
          </div>

          {/* Stats by document type */}
          {appStats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng hồ sơ</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{appStats.total}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Chờ duyệt</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{appStats.submitted}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Đã duyệt</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{appStats.approved}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Trả lại</p>
                  <p className="mt-1 text-2xl font-bold text-rose-900">{appStats.returned}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {appStats.byType.map((stat) => {
                  const meta = getDocumentTypeMeta(stat.code);
                  const maxBar = Math.max(1, ...appStats.byType.map((x) => x.total));
                  const pct = Math.round((stat.total / maxBar) * 100);
                  return (
                    <button
                      key={stat.code}
                      type="button"
                      onClick={() =>
                        setDocTypeFilter((prev) => (prev === stat.code ? 'ALL' : stat.code))
                      }
                      className={
                        'rounded-xl border p-3 text-left shadow-sm transition ' +
                        (docTypeFilter === stat.code
                          ? meta.accentClass + ' ring-2 ring-slate-400'
                          : 'border-slate-100 bg-white hover:border-slate-300')
                      }
                      title={`Lọc ${stat.label}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          <span className="mr-1" aria-hidden>
                            {stat.icon}
                          </span>
                          {stat.label}
                        </span>
                        <span className="text-lg font-bold">{stat.total}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div
                          className="h-full rounded-full bg-slate-700/40"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Chờ {stat.submitted} · Duyệt {stat.approved} · Trả {stat.returned}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter tabs by document type */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDocTypeFilter('ALL')}
                className={
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
                  (docTypeFilter === 'ALL'
                    ? 'border-slate-800 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                Tất cả loại
                <span className="ml-1 opacity-70">({appStats?.total ?? citizenApps.length})</span>
              </button>
              {DOCUMENT_TYPES.map((t) => {
                const count = appStats?.byType.find((x) => x.code === t.code)?.total ?? 0;
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => setDocTypeFilter(t.code)}
                    className={
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
                      (docTypeFilter === t.code
                        ? t.badgeClass + ' ring-1 ring-offset-1 ring-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                    }
                  >
                    {t.icon} {t.label}
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'SUBMITTED', label: 'Chờ duyệt' },
                  { key: 'APPROVED', label: 'Đã duyệt' },
                  { key: 'RETURNED', label: 'Cần bổ sung' },
                  { key: 'ALL', label: 'Mọi trạng thái' },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key)}
                  className={
                    'rounded-md border px-2.5 py-1 text-xs font-medium ' +
                    (statusFilter === s.key
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filteredCitizenApps.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 border border-dashed border-slate-200">
              {citizenApps.length === 0
                ? 'Chưa có hồ sơ nào được nộp.'
                : statusFilter === 'SUBMITTED'
                  ? 'Không còn hồ sơ chờ duyệt — chọn bộ lọc khác để xem đã duyệt / cần bổ sung.'
                  : 'Không có hồ sơ khớp bộ lọc hiện tại.'}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Nhấn vào một hồ sơ để xem chi tiết và phê duyệt / trả lại.
              </p>
              {filteredCitizenApps.map((app) => {
                const typeMeta = getDocumentTypeMeta(app.documentType);
                const title =
                  app.documentTypeLabel || typeMeta.label || app.procedureName;
                const detailHref = `${portalHome}/applications/${encodeURIComponent(app.id)}`;
                const statusUi =
                  app.status === 'SUBMITTED'
                    ? {
                        text: 'CHỜ DUYỆT',
                        className: 'bg-amber-100 text-amber-800 border-amber-200',
                      }
                    : app.status === 'APPROVED'
                      ? {
                          text: 'ĐÃ DUYỆT',
                          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                        }
                      : {
                          text: 'CẦN BỔ SUNG',
                          className: 'bg-rose-100 text-rose-800 border-rose-200',
                        };
                return (
                  <Link
                    key={app.id}
                    href={detailHref}
                    className="card block border border-slate-100 p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">
                            <span className="mr-1" aria-hidden>
                              {typeMeta.icon}
                            </span>
                            {title}
                          </span>
                          <DocumentTypeBadge code={app.documentType} />
                          <span
                            className={
                              'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ' +
                              statusUi.className
                            }
                          >
                            {statusUi.text}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {app.procedureName}
                          {' · '}
                          <span className="font-mono">{app.formCode}</span>
                          {' · '}nộp {formatDate(app.submittedAt)}
                          {app.reviewedBy ? ` · ${app.reviewedBy}` : ''}
                        </p>
                        {app.status === 'RETURNED' && app.reviewNote ? (
                          <p className="line-clamp-1 text-xs text-amber-800">
                            Lý do: {app.reviewNote}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-sky-700">
                        Xem chi tiết →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="border-b pb-4">
            <h3 className="text-xl font-bold text-slate-900">Yêu cầu Thay đổi quy định & Biểu mẫu (Change Requests)</h3>
            <p className="text-sm text-slate-500">
              Danh sách các đề xuất thay đổi nội dung pháp lý hoặc giao diện thu nhận cần phê duyệt để áp dụng ngay lập tức.
            </p>
          </div>

          {changeRequests.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 border border-dashed border-slate-200">
              Không có yêu cầu thay đổi nào trong hệ thống.
            </div>
          ) : (
            <div className="space-y-6">
              {changeRequests.map((cr) => {
                const isPending = cr.status === 'PENDING';
                const result = approvalResults[cr.id];
                
                return (
                  <div key={cr.id} className="card border border-slate-100 shadow-sm space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">
                            Yêu cầu cập nhật: {cr.oldVersion.formCode}
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                              cr.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : cr.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}
                          >
                            {cr.status === 'PENDING' ? 'CHỜ PHÊ DUYỆT' : cr.status === 'APPROVED' ? 'ĐÃ ÁP DỤNG' : 'ĐÃ TỪ CHỐI'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Tạo ngày: {formatDate(cr.createdAt)} · Phiên bản cũ: {cr.oldVersion.version} → Đích đề xuất: {cr.proposedTargetVersion}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {(() => {
                          const verifiedUrl = safeHttpsUrl(cr.sourceUrl);
                          if (verifiedUrl) {
                            return (
                              <a
                                href={verifiedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline"
                              >
                                Quyết định đính kèm ↗
                              </a>
                            );
                          } else {
                            const displayUrl = typeof cr.sourceUrl === 'string'
                              ? (cr.sourceUrl.length > 50 ? cr.sourceUrl.slice(0, 47) + '...' : cr.sourceUrl)
                              : '';
                            return (
                              <span className="text-xs font-semibold text-slate-400">
                                {displayUrl}
                              </span>
                            );
                          }
                        })()}

                        {isPending && canApproveActions && (
                          <button
                            onClick={() => handleApprove(cr.id)}
                            disabled={approvingId !== null}
                            className="btn bg-amber-600 hover:bg-amber-500 text-white text-sm py-2 px-4 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {approvingId === cr.id ? (
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Đang kích hoạt...
                              </div>
                            ) : (
                              'Phê duyệt & kích hoạt'
                            )}
                          </button>
                        )}
                        {isPending && !canApproveActions && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                            Chỉ xem — cần quyền admin để phê duyệt
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-1">Tóm tắt thay đổi:</h4>
                        <p className="text-sm text-slate-600 italic">“{cr.diff.summary}”</p>
                      </div>

                      <div className="border border-slate-100 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-slate-500">Mã trường (ID)</th>
                              <th className="px-4 py-2 text-left font-semibold text-slate-500">Tên nhãn trường (Label)</th>
                              <th className="px-4 py-2 text-center font-semibold text-slate-500">Phân loại thay đổi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {cr.diff.added.map((item) => (
                              <tr key={`add-${item.id}`} className="bg-emerald-50/40 text-emerald-900">
                                <td className="px-4 py-2 font-mono font-medium">{item.id}</td>
                                <td className="px-4 py-2">{item.label}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Thêm mới
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.removed.map((item) => (
                              <tr key={`remove-${item.id}`} className="bg-rose-50/40 text-rose-900 line-through decoration-rose-400">
                                <td className="px-4 py-2 font-mono">{item.id}</td>
                                <td className="px-4 py-2">{item.label}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Xóa bỏ
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.changed.map((item) => (
                              <tr key={`change-${item.id}`} className="bg-amber-50/40 text-amber-900">
                                <td className="px-4 py-2 font-mono font-medium">{item.id}</td>
                                <td className="px-4 py-2">
                                  {item.oldLabel && item.newLabel ? (
                                    <span>
                                      {item.oldLabel} <span className="text-slate-400 font-mono mx-1">→</span>{' '}
                                      <strong className="text-amber-800">{item.newLabel}</strong>
                                    </span>
                                  ) : (
                                    item.label
                                  )}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Thay đổi cấu hình
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.added.length === 0 &&
                              cr.diff.removed.length === 0 &&
                              cr.diff.changed.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">
                                    Cập nhật các thuộc tính quy trình nội bộ, cấu trúc trường không đổi.
                                  </td>
                                </tr>
                              )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {(() => {
                      if (!result) return null;

                      const isActivatedVersionValid = typeof result.activatedVersion === 'string' && versionRegex.test(result.activatedVersion);
                      const isClosedVersionValid = result.closedVersion === null || (typeof result.closedVersion === 'string' && versionRegex.test(result.closedVersion));

                      return (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>🎉</span> Đã duyệt áp dụng thay đổi thành công!
                          </div>
                          {isActivatedVersionValid && isClosedVersionValid ? (
                            <>
                              <div>
                                • Phiên bản mới hoạt động: <strong className="font-mono">{result.activatedVersion}</strong>
                              </div>
                              {result.closedVersion && (
                                <div>
                                  • Phiên bản cũ đóng lại: <strong className="font-mono">{result.closedVersion}</strong>
                                </div>
                              )}
                            </>
                          ) : (
                            <div>• Đã phê duyệt & kích hoạt thành công</div>
                          )}
                          <div className="text-xs text-emerald-600 mt-1">
                            Hiệu lực từ: {formatDate(result.effectiveFrom)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
