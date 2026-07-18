/**
 * Shared types for staff Admin/Manager console.
 */

export type StaffConsoleRole = 'manager' | 'admin';

export interface StaffConsoleProps {
  /**
   * manager — duyệt hồ sơ công dân (APPROVE/RETURN), xem overview + change requests
   *           (không phê duyệt phiên bản biểu mẫu)
   * admin — đầy đủ quyền, gồm phê duyệt & kích hoạt phiên bản
   */
  role?: StaffConsoleRole;
}

export interface FormVersionOverview {
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface ProcedureOverview {
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

export interface ServiceUsage {
  calls: number;
  tokens?: number;
  audioSeconds?: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  cacheHits: number;
  degradedCount: number;
}

export interface UsageSummary {
  llm?: ServiceUsage;
  stt?: ServiceUsage;
  tts?: ServiceUsage;
}

export interface OverviewResponse {
  procedures: ProcedureOverview[];
  usage: UsageSummary;
}

export interface DiffItem {
  id: string;
  label: string;
  oldLabel?: string;
  newLabel?: string;
}

export interface ChangeRequest {
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

export interface ApprovalResult {
  changeRequestId: string;
  status: string;
  formCode: string;
  activatedVersion: string;
  closedVersion: string | null;
  effectiveFrom: string;
}

// Module-private pure helpers
