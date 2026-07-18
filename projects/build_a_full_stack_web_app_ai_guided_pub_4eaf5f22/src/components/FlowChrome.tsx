'use client';

import Breadcrumb, { ProgressIndicator } from '@/components/Breadcrumb';
import BrandLogo from '@/components/BrandLogo';

export const FLOW_STEPS = [
  { key: 'chat', label: 'Tư vấn' },
  { key: 'checklist', label: 'Giấy tờ' },
  { key: 'form', label: 'Biểu mẫu' },
  { key: 'result', label: 'Kiểm tra' },
  { key: 'approval', label: 'Nộp & duyệt' },
] as const;

export type FlowStepKey = (typeof FLOW_STEPS)[number]['key'];

interface FlowChromeProps {
  current: FlowStepKey;
  /** Tiêu đề ngắn hiển thị cạnh breadcrumb (tuỳ chọn) */
  title?: string;
  className?: string;
}

/**
 * Chrome điều hướng chung cho luồng hồ sơ:
 * glass sticky header + BrandLogo + breadcrumb + progress stepper.
 * Không xử lý state nghiệp vụ — chỉ nhận `current` và render UI.
 */
export default function FlowChrome({ current, title, className = '' }: FlowChromeProps) {
  const idx = FLOW_STEPS.findIndex((s) => s.key === current);
  const safeIdx = idx < 0 ? 0 : idx;

  const steps = FLOW_STEPS.map((s, i) => ({
    label: s.label,
    status: (i < safeIdx ? 'completed' : i === safeIdx ? 'current' : 'upcoming') as
      | 'completed'
      | 'current'
      | 'upcoming',
  }));

  return (
    <header
      className={`sticky top-0 z-20 border-b border-white/40 bg-white/70 shadow-shell-lg backdrop-blur-glass supports-[backdrop-filter]:bg-white/55 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-300/60 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-4xl space-y-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <BrandLogo size="sm" href="/user" />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <Breadcrumb />
          </div>
          {title ? (
            <h1 className="text-title tracking-snugish text-slate-900">{title}</h1>
          ) : null}
        </div>

        <ProgressIndicator steps={steps} className="hidden sm:block" />

        <p className="text-sm font-medium tracking-snugish text-brand-700 sm:hidden" aria-live="polite">
          Bước {safeIdx + 1}/{FLOW_STEPS.length}: {FLOW_STEPS[safeIdx].label}
        </p>
      </div>
    </header>
  );
}
