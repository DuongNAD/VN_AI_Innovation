'use client';

import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { visibleFieldsFor } from '@/components/DynamicForm';
import type { FieldDef } from '@/lib/schema-guards';
import { DEFAULT_TTS_MODE, isTtsMode, type TtsMode } from '@/lib/tts-mode';
import AttachmentPreviewLink from '@/components/AttachmentPreviewLink';

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
  data: Record<string, unknown>;
  fields: FieldDef[];
}

type AccountRole = 'user' | 'manager' | 'admin';

interface AccountUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: AccountRole;
  createdAt: string;
  hasPassword: boolean;
}

const ROLE_LABELS: Record<AccountRole, string> = {
  user: 'Công dân',
  manager: 'Cán bộ quản lý',
  admin: 'Quản trị viên',
};

const ROLE_BADGE_CLASS: Record<AccountRole, string> = {
  user: 'bg-slate-100 text-slate-700 border-slate-200',
  manager: 'bg-sky-100 text-sky-800 border-sky-200',
  admin: 'bg-amber-100 text-amber-800 border-amber-200',
};

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
      data,
      fields,
    });
  }
  return parsed;
}

/** Account list from the admin-only users API — strictly bounded like the other parsers. */
function parseAccounts(body: unknown): AccountUser[] | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.users) || obj.users.length > 500) {
    return null;
  }
  const parsed: AccountUser[] = [];
  for (const raw of obj.users) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const u = raw as Record<string, unknown>;
    if (!isSafeId(u.id)) {
      continue;
    }
    if (!isBoundedString(u.username, 100) || !isBoundedString(u.displayName, 200)) {
      continue;
    }
    if (!isNullableBoundedString(u.email, 200)) {
      continue;
    }
    if (u.role !== 'user' && u.role !== 'manager' && u.role !== 'admin') {
      continue;
    }
    if (!isBoundedString(u.createdAt, 500)) {
      continue;
    }
    parsed.push({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email ?? null,
      role: u.role,
      createdAt: u.createdAt,
      hasPassword: u.hasPassword === true,
    });
  }
  return parsed;
}

/** Human-readable value for the officer's review table (option labels, Có/Không, dd/mm/yyyy). */
function fmtFieldValue(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '(trống)';
  }
  if (field.options && field.options.length > 0) {
    const match = field.options.find((o) => o.value === value || String(o.value) === String(value));
    if (match) {
      return match.label;
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function errorMessageFor(status: number, code: string | null, serverMessage?: string | null): string {
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
    if (code === 'CONFLICT') {
      return 'Tên tài khoản hoặc email đã được sử dụng';
    }
  }
  if (status === 400) {
    if (code === 'INVALID_TARGET_VERSION') {
      return 'Phiên bản đích không hợp lệ';
    }
    if (code === 'NOTE_REQUIRED') {
      return 'Vui lòng nhập lý do trả lại để người dân biết cần bổ sung gì';
    }
    if (code === 'SELF_ROLE_FORBIDDEN') {
      return 'Không thể tự thay đổi vai trò của chính mình';
    }
  }
  if (status === 422 && code === 'VALIDATION_FAILED') {
    return 'Hồ sơ còn lỗi theo quy định nên không thể phê duyệt';
  }
  if (status === 429) {
    return 'Quá nhiều lần thử, chờ ít phút';
  }
  // Our own API sends short Vietnamese messages — surface them when we have
  // no specific mapping (e.g. 403 "thuộc thẩm quyền của cán bộ quản lý").
  if (typeof serverMessage === 'string' && serverMessage.length > 0 && serverMessage.length <= 300) {
    return serverMessage;
  }
  return 'Có lỗi xảy ra, vui lòng thử lại';
}

const getErrorFromResponse = async (
  res: Response
): Promise<{ status: number; code: string | null; message: string | null }> => {
  let code: string | null = null;
  let message: string | null = null;
  try {
    const data = await res.json();
    if (data && data.error && typeof data.error.code === 'string') {
      code = data.error.code;
    }
    if (data && data.error && typeof data.error.message === 'string') {
      message = data.error.message;
    }
  } catch (_) {
    // ignore
  }
  return { status: res.status, code, message };
};

export type StaffConsoleRole = 'manager' | 'admin';

export interface StaffConsoleProps {
  /**
   * manager — toàn bộ nghiệp vụ: xét duyệt hồ sơ công dân + quản lý giấy tờ,
   *           biểu mẫu (phê duyệt & kích hoạt phiên bản)
   * admin — quản lý tài khoản và cài đặt kỹ thuật hệ thống (KHÔNG xét duyệt
   *         hồ sơ, KHÔNG phê duyệt biểu mẫu)
   */
  role?: StaffConsoleRole;
}

export default function AdminConsole({ role = 'admin' }: StaffConsoleProps): ReactElement {
  const isAdmin = role === 'admin';
  const canApproveForms = role === 'manager';
  const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Người quản lý';

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [approvalResults, setApprovalResults] = useState<Record<string, ApprovalResult>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [citizenApps, setCitizenApps] = useState<CitizenApplication[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [ttsMode, setTtsMode] = useState<TtsMode>(DEFAULT_TTS_MODE);
  const [savingTtsMode, setSavingTtsMode] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<AccountUser[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AccountRole>>({});
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    role: 'manager' as AccountRole,
  });
  const [newAccountPasswordConfirm, setNewAccountPasswordConfirm] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);
  const [passwordTarget, setPasswordTarget] = useState<AccountUser | null>(null);
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [showNextPassword, setShowNextPassword] = useState(false);

  const passwordValidationMessage = (password: string, confirmation: string): string | null => {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.';
    }
    if (password !== confirmation) {
      return 'Hai lần nhập mật khẩu chưa trùng khớp.';
    }
    return null;
  };

  const closePasswordDialog = () => {
    if (accountBusyId !== null) return;
    setPasswordTarget(null);
    setNextPassword('');
    setNextPasswordConfirm('');
    setShowNextPassword(false);
  };

  const handleFetchData = async (opts?: { silent?: boolean }) => {
    setLoading(true);
    setError(null);
    if (!opts?.silent) {
      setSuccess(null);
    }

    try {
      // The third dataset is role-specific: managers work the citizen queue,
      // admins manage accounts. Neither may fetch the other's (API enforces it).
      const extraUrl = role === 'manager' ? '/api/v1/admin/applications' : '/api/v1/admin/users';
      const [overviewRes, crRes, extraRes] = await Promise.all([
        fetch('/api/v1/admin/overview', {
          credentials: 'include',
        }),
        fetch('/api/v1/admin/change-requests', {
          credentials: 'include',
        }),
        fetch(extraUrl, {
          credentials: 'include',
        }),
      ]);

      if (!overviewRes.ok) {
        const { status, code, message } = await getErrorFromResponse(overviewRes);
        throw new Error(errorMessageFor(status, code, message));
      }
      if (!crRes.ok) {
        const { status, code, message } = await getErrorFromResponse(crRes);
        throw new Error(errorMessageFor(status, code, message));
      }
      if (!extraRes.ok) {
        const { status, code, message } = await getErrorFromResponse(extraRes);
        throw new Error(errorMessageFor(status, code, message));
      }

      let rawOverview: unknown;
      let rawCRs: unknown;
      let rawExtra: unknown;
      try {
        rawOverview = await overviewRes.json();
        rawCRs = await crRes.json();
        rawExtra = await extraRes.json();
      } catch (_) {
        throw new Error(errorMessageFor(500, 'JSON_PARSE_FAILURE'));
      }

      const parsedOverview = parseOverview(rawOverview);
      const parsedCRs = parseChangeRequests(rawCRs);

      if (parsedOverview === null || parsedCRs === null) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      if (role === 'manager') {
        const parsedApps = parseCitizenApplications(rawExtra);
        if (parsedApps === null) {
          throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
        }
        setCitizenApps(parsedApps);
        setAccounts([]);
      } else {
        const parsedAccounts = parseAccounts(rawExtra);
        if (parsedAccounts === null) {
          throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
        }
        setAccounts(parsedAccounts);
        setCitizenApps([]);
      }

      setOverview(parsedOverview);
      setChangeRequests(parsedCRs);
      setTtsMode(parsedOverview.ttsMode);

      if (rawOverview && typeof rawOverview === 'object') {
        const actor = (rawOverview as Record<string, unknown>).actor;
        if (actor && typeof actor === 'object') {
          const dn = (actor as Record<string, unknown>).displayName;
          if (typeof dn === 'string') setActorName(dn);
          const aid = (actor as Record<string, unknown>).id;
          if (isSafeId(aid)) setActorId(aid);
        }
      }

      if (!opts?.silent) {
        setSuccess(
          role === 'admin'
            ? 'Tải dữ liệu quản trị thành công.'
            : 'Tải dữ liệu người quản lý thành công.'
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

  const handleReviewApplication = async (id: string, decision: 'APPROVE' | 'RETURN') => {
    if (!isSafeId(id)) {
      setError('Mã hồ sơ không hợp lệ.');
      return;
    }
    const note = (reviewNotes[id] ?? '').trim();
    if (decision === 'RETURN' && note === '') {
      setError(errorMessageFor(400, 'NOTE_REQUIRED'));
      return;
    }

    setReviewingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/admin/applications/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision, note: note === '' ? undefined : note }),
      });

      if (!res.ok) {
        const { status, code } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code));
      }

      setSuccess(
        decision === 'APPROVE'
          ? 'Đã phê duyệt hồ sơ. Người dân sẽ thấy kết quả ngay trên trang trạng thái.'
          : 'Đã trả lại hồ sơ kèm lý do để người dân bổ sung.'
      );
      setReviewNotes((prev) => ({ ...prev, [id]: '' }));
      await handleFetchData({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setReviewingId(null);
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (creatingAccount) return;
    const validationError = passwordValidationMessage(
      newAccount.password,
      newAccountPasswordConfirm
    );
    if (validationError) {
      setAccountError(validationError);
      setAccountSuccess(null);
      return;
    }
    setCreatingAccount(true);
    setAccountError(null);
    setAccountSuccess(null);
    try {
      const payload: Record<string, string> = {
        username: newAccount.username.trim().toLowerCase(),
        displayName: newAccount.displayName.trim(),
        password: newAccount.password,
        role: newAccount.role,
      };
      if (newAccount.email.trim() !== '') {
        payload.email = newAccount.email.trim();
      }
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { status, code, message } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code, message));
      }
      setAccountSuccess(
        `Đã tạo tài khoản ${payload.username} (${ROLE_LABELS[newAccount.role]}). Có thể đăng nhập ngay bằng mật khẩu vừa đặt.`
      );
      setNewAccount({ username: '', displayName: '', email: '', password: '', role: 'manager' });
      setNewAccountPasswordConfirm('');
      setShowCreatePassword(false);
      await handleFetchData({ silent: true });
    } catch (err: any) {
      setAccountError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleAccountRoleChange = async (id: string) => {
    if (!isSafeId(id)) {
      setError('Mã tài khoản không hợp lệ.');
      return;
    }
    const nextRole = roleDrafts[id];
    if (!nextRole) return;
    setAccountBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const { status, code, message } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code, message));
      }
      setSuccess(`Đã đổi vai trò tài khoản sang ${ROLE_LABELS[nextRole]}.`);
      setRoleDrafts((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      await handleFetchData({ silent: true });
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setAccountBusyId(null);
    }
  };

  const handleAccountPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordTarget || accountBusyId !== null) return;
    if (!isSafeId(passwordTarget.id)) {
      setAccountError('Mã tài khoản không hợp lệ.');
      return;
    }
    const validationError = passwordValidationMessage(nextPassword, nextPasswordConfirm);
    if (validationError) {
      setAccountError(validationError);
      setAccountSuccess(null);
      return;
    }
    const target = passwordTarget;
    const isSelf = actorId !== null && target.id === actorId;
    setAccountBusyId(target.id);
    setAccountError(null);
    setAccountSuccess(null);
    try {
      const res = await fetch(`/api/v1/admin/users/${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nextPassword }),
      });
      if (!res.ok) {
        const { status, code, message } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code, message));
      }
      setPasswordTarget(null);
      setNextPassword('');
      setNextPasswordConfirm('');
      setShowNextPassword(false);
      if (isSelf) {
        window.location.assign('/admin/login?passwordChanged=1');
        return;
      }
      setAccountSuccess(
        `Đã đặt mật khẩu mới cho ${target.username}. Tất cả phiên đăng nhập cũ của tài khoản này đã bị thu hồi.`
      );
      await handleFetchData({ silent: true });
    } catch (err: any) {
      setAccountError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setAccountBusyId(null);
    }
  };

  useEffect(() => {
    void handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleApprove = async (id: string) => {
    if (!isSafeId(id)) {
      setError('Mã yêu cầu không hợp lệ.');
      return;
    }

    setApprovingId(id);
    setError(null);
    setSuccess(null);

    try {
      if (!canApproveForms) {
        setError('Phê duyệt phiên bản biểu mẫu thuộc thẩm quyền của cán bộ quản lý.');
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
      <div className="card border border-slate-200/80 bg-white p-6 shadow-shell">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Bảng điều khiển {roleLabel}
            </h2>
            <p className="text-sm text-slate-600">
              {isAdmin
                ? 'Phiên đăng nhập cookie — quản lý tài khoản và cài đặt kỹ thuật hệ thống.'
                : 'Phiên đăng nhập cookie — xét duyệt hồ sơ công dân, quản lý giấy tờ & biểu mẫu, phê duyệt phiên bản khi quy định thay đổi.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${
                  role === 'admin'
                    ? 'border-amber-200/70 bg-amber-50 text-amber-800'
                    : 'border-sky-200/70 bg-sky-50 text-sky-700'
                }`}
              >
                Vai trò: {role}
              </span>
              {actorName ? (
                <span className="inline-flex max-w-[16rem] items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                  <span className="truncate">Phiên: {actorName}</span>
                </span>
              ) : null}
              {isAdmin && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-500">
                  Hồ sơ &amp; biểu mẫu do cán bộ quản lý phụ trách
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleFetchData()}
            disabled={loading}
            className="btn shrink-0 bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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

      {overview && isAdmin && (
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

      {overview && role === 'manager' && (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-xl font-bold text-slate-900">Hồ sơ công dân chờ xét duyệt</h3>
            <p className="text-sm text-slate-500">
              Hồ sơ người dân đã kiểm tra hợp lệ và nộp trực tuyến. Phê duyệt hoặc trả lại kèm lý
              do — kết quả hiển thị ngay trên trang trạng thái của người dân.
            </p>
          </div>

          {citizenApps.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 border border-dashed border-slate-200">
              Chưa có hồ sơ nào được nộp.
            </div>
          ) : (
            <div className="space-y-6">
              {citizenApps.map((app) => {
                const isPendingReview = app.status === 'SUBMITTED';
                const reviewFields = visibleFieldsFor(app.fields, app.data).filter((f) => {
                  const v = app.data[f.id];
                  return v !== undefined && v !== null && v !== '';
                });
                return (
                  <div key={app.id} className="card border border-slate-100 shadow-sm space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">{app.procedureName}</span>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                              app.status === 'SUBMITTED'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : app.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}
                          >
                            {app.status === 'SUBMITTED'
                              ? 'CHỜ DUYỆT'
                              : app.status === 'APPROVED'
                              ? 'ĐÃ DUYỆT'
                              : 'ĐÃ TRẢ LẠI'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Biểu mẫu {app.formCode} · phiên bản {app.formVersion} · nộp lúc:{' '}
                          {formatDate(app.submittedAt)}
                          {app.reviewedAt
                            ? ` · xử lý lúc: ${formatDate(app.reviewedAt)}${app.reviewedBy ? ' bởi ' + app.reviewedBy : ''}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="border border-slate-100 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-500 w-1/3">Trường thông tin</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-500">Nội dung khai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {reviewFields.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-4 py-4 text-center text-slate-400 italic">
                                Hồ sơ không có dữ liệu hiển thị.
                              </td>
                            </tr>
                          ) : (
                            reviewFields.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-slate-600">{f.label}</td>
                                <td className="px-4 py-2 font-medium text-slate-900">
                                  {f.type === 'file' &&
                                  typeof app.data[f.id] === 'string' &&
                                  app.data[f.id] !== '' ? (
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                      <span>{fmtFieldValue(f, app.data[f.id])}</span>
                                      <AttachmentPreviewLink
                                        applicationId={app.id}
                                        fieldId={f.id}
                                        fileName={String(app.data[f.id])}
                                        compact
                                      />
                                    </span>
                                  ) : (
                                    fmtFieldValue(f, app.data[f.id])
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {app.status === 'RETURNED' && app.reviewNote && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                        <span className="font-semibold">Lý do trả lại:</span> {app.reviewNote}
                      </div>
                    )}
                    {app.status === 'APPROVED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
                        🎉 Hồ sơ đã được phê duyệt{app.reviewNote ? ` — ghi chú: ${app.reviewNote}` : '.'}
                      </div>
                    )}

                    {isPendingReview && (
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor={`note-${app.id}`}>
                          Ghi chú cho người dân (bắt buộc khi trả lại)
                        </label>
                        <textarea
                          id={`note-${app.id}`}
                          rows={2}
                          maxLength={1000}
                          value={reviewNotes[app.id] ?? ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                          }
                          placeholder="Ví dụ: Bổ sung bản chụp trang thông tin CCCD của bên nữ."
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleReviewApplication(app.id, 'APPROVE')}
                            disabled={reviewingId !== null}
                            className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 px-4 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {reviewingId === app.id ? 'Đang xử lý...' : '✅ Phê duyệt hồ sơ'}
                          </button>
                          <button
                            onClick={() => handleReviewApplication(app.id, 'RETURN')}
                            disabled={reviewingId !== null || (reviewNotes[app.id] ?? '').trim() === ''}
                            className="btn bg-amber-600 hover:bg-amber-500 text-white text-sm py-2 px-4 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            ↩ Trả lại để bổ sung
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {overview && isAdmin && (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-xl font-bold text-slate-900">Quản lý tài khoản</h3>
            <p className="text-sm text-slate-500">
              Cấp tài khoản cán bộ, đổi vai trò và đặt lại mật khẩu. Tài khoản quản lý/quản trị
              chỉ được cấp tại đây — không thể tự đăng ký. Hồ sơ công dân và giấy tờ, biểu mẫu
              do cán bộ quản lý phụ trách tại cổng người quản lý.
            </p>
          </div>

          {accountError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <strong>Không thể hoàn tất:</strong> {accountError}
            </div>
          )}
          {accountSuccess && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <strong>Thành công:</strong> {accountSuccess}
            </div>
          )}

          <form
            onSubmit={handleCreateAccount}
            className="card border border-slate-100 shadow-sm space-y-4 p-6"
          >
            <div>
              <h4 className="text-base font-bold text-slate-800">Tạo tài khoản mới</h4>
              <p className="mt-1 text-xs text-slate-500">
                Điền đầy đủ thông tin và đặt mật khẩu đăng nhập ban đầu cho tài khoản.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <input
                value={newAccount.username}
                onChange={(e) => setNewAccount((p) => ({ ...p, username: e.target.value }))}
                placeholder="Tên đăng nhập (a-z, 0-9, . _)"
                required
                minLength={3}
                maxLength={50}
                disabled={creatingAccount}
                autoComplete="off"
                aria-label="Tên đăng nhập"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <input
                value={newAccount.displayName}
                onChange={(e) => setNewAccount((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Họ và tên hiển thị"
                required
                maxLength={100}
                disabled={creatingAccount}
                aria-label="Họ và tên hiển thị"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <input
                type="email"
                value={newAccount.email}
                onChange={(e) => setNewAccount((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email (không bắt buộc)"
                maxLength={200}
                disabled={creatingAccount}
                autoComplete="off"
                aria-label="Email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <div className="relative">
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={newAccount.password}
                  onChange={(e) => setNewAccount((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mật khẩu (≥8, có chữ và số)"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={creatingAccount}
                  autoComplete="new-password"
                  aria-label="Mật khẩu đăng nhập"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-16 text-sm focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((visible) => !visible)}
                  disabled={creatingAccount}
                  className="absolute inset-y-0 right-2 text-xs font-semibold text-brand-700 disabled:text-slate-400"
                  aria-label={showCreatePassword ? 'Ẩn mật khẩu tạo tài khoản' : 'Hiện mật khẩu tạo tài khoản'}
                >
                  {showCreatePassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <input
                type={showCreatePassword ? 'text' : 'password'}
                value={newAccountPasswordConfirm}
                onChange={(e) => setNewAccountPasswordConfirm(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                required
                minLength={8}
                maxLength={128}
                disabled={creatingAccount}
                autoComplete="new-password"
                aria-label="Nhập lại mật khẩu đăng nhập"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <select
                value={newAccount.role}
                onChange={(e) => setNewAccount((p) => ({ ...p, role: e.target.value as AccountRole }))}
                disabled={creatingAccount}
                aria-label="Vai trò"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              >
                {(['user', 'manager', 'admin'] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.</p>
              <button
                type="submit"
                disabled={creatingAccount}
                className="btn bg-slate-900 hover:bg-slate-700 text-white text-sm py-2 px-5 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {creatingAccount ? 'Đang tạo tài khoản...' : '➕ Tạo tài khoản mới'}
              </button>
            </div>
          </form>

          <div className="card border border-slate-100 shadow-sm p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Tài khoản</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Vai trò</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Ngày tạo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Mật khẩu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có tài khoản nào.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => {
                      const isSelf = actorId !== null && acc.id === actorId;
                      const busy = accountBusyId !== null;
                      const draftRole = roleDrafts[acc.id] ?? acc.role;
                      return (
                        <tr key={acc.id} className="hover:bg-slate-50 align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{acc.displayName}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              {acc.username}
                              {isSelf && (
                                <span className="ml-1 font-sans font-semibold text-amber-600">(bạn)</span>
                              )}
                              {!acc.hasPassword && (
                                <span className="ml-1 font-sans text-sky-600">· OAuth</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{acc.email ?? '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${ROLE_BADGE_CLASS[acc.role]}`}
                              >
                                {ROLE_LABELS[acc.role]}
                              </span>
                              {!isSelf && (
                                <>
                                  <select
                                    value={draftRole}
                                    onChange={(e) =>
                                      setRoleDrafts((prev) => ({
                                        ...prev,
                                        [acc.id]: e.target.value as AccountRole,
                                      }))
                                    }
                                    disabled={busy}
                                    aria-label={`Vai trò mới cho ${acc.username}`}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                  >
                                    {(['user', 'manager', 'admin'] as const).map((r) => (
                                      <option key={r} value={r}>
                                        {ROLE_LABELS[r]}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAccountRoleChange(acc.id)}
                                    disabled={busy || draftRole === acc.role}
                                    className="btn bg-slate-700 hover:bg-slate-600 text-white text-xs py-1 px-2.5 disabled:bg-slate-200 disabled:text-slate-400"
                                  >
                                    {accountBusyId === acc.id ? 'Đang lưu...' : 'Đổi vai trò'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                            {formatDate(acc.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTarget(acc);
                                setNextPassword('');
                                setNextPasswordConfirm('');
                                setShowNextPassword(false);
                                setAccountError(null);
                                setAccountSuccess(null);
                              }}
                              disabled={busy}
                              aria-label={`${acc.hasPassword ? 'Đặt mật khẩu mới' : 'Tạo mật khẩu đăng nhập'} cho ${acc.username}`}
                              className="btn border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {accountBusyId === acc.id
                                ? 'Đang cập nhật...'
                                : acc.hasPassword
                                  ? 'Đặt mật khẩu mới'
                                  : 'Tạo mật khẩu đăng nhập'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {passwordTarget && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closePasswordDialog();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-dialog-title"
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              >
                <form onSubmit={handleAccountPasswordReset} className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 id="password-dialog-title" className="text-lg font-bold text-slate-900">
                        {passwordTarget.hasPassword ? 'Đặt mật khẩu mới' : 'Tạo mật khẩu đăng nhập'}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600">
                        Tài khoản <strong>{passwordTarget.username}</strong> · {passwordTarget.displayName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closePasswordDialog}
                      disabled={accountBusyId !== null}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      aria-label="Đóng hộp thoại đặt mật khẩu"
                    >
                      ✕
                    </button>
                  </div>

                  {actorId === passwordTarget.id && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Đây là tài khoản bạn đang dùng. Sau khi đổi mật khẩu, bạn sẽ được yêu cầu đăng nhập lại.
                    </div>
                  )}

                  {accountError && (
                    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {accountError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      Mật khẩu mới
                      <div className="relative mt-1.5">
                        <input
                          type={showNextPassword ? 'text' : 'password'}
                          value={nextPassword}
                          onChange={(e) => setNextPassword(e.target.value)}
                          required
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                          disabled={accountBusyId !== null}
                          aria-label="Mật khẩu mới"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-16 font-normal focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNextPassword((visible) => !visible)}
                          disabled={accountBusyId !== null}
                          className="absolute inset-y-0 right-3 text-xs font-semibold text-brand-700 disabled:text-slate-400"
                          aria-label={showNextPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                        >
                          {showNextPassword ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Nhập lại mật khẩu mới
                      <input
                        type={showNextPassword ? 'text' : 'password'}
                        value={nextPasswordConfirm}
                        onChange={(e) => setNextPasswordConfirm(e.target.value)}
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        disabled={accountBusyId !== null}
                        aria-label="Nhập lại mật khẩu mới"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                    <p className="text-xs text-slate-500">
                      Ít nhất 8 ký tự, gồm chữ và số. Các phiên đăng nhập cũ sẽ bị thu hồi.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={closePasswordDialog}
                      disabled={accountBusyId !== null}
                      className="btn border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={accountBusyId !== null || nextPassword === '' || nextPasswordConfirm === ''}
                      className="btn bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {accountBusyId !== null ? 'Đang cập nhật...' : 'Lưu mật khẩu mới'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {overview && (
        <div className="space-y-6">
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

                        {isPending && canApproveForms && (
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
                        {isPending && !canApproveForms && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                            Chỉ xem — biểu mẫu do cán bộ quản lý phê duyệt
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
