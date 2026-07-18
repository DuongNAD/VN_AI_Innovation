'use client';

import Breadcrumb, { ProgressIndicator } from '@/components/Breadcrumb';
import BackButton from '@/components/BackButton';
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
  /** Chế độ độc lập cho trang không có UserBar (ví dụ chat khách). */
  standalone?: boolean;
  className?: string;
}

/**
 * Chrome điều hướng chung cho luồng hồ sơ:
 * glass sticky header + BrandLogo + breadcrumb + progress stepper.
 * Không xử lý state nghiệp vụ — chỉ nhận `current` và render UI.
 */
export default function FlowChrome({ current, title, standalone = false, className = '' }: FlowChromeProps) {
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

      <div className="relative mx-auto w-full max-w-5xl space-y-2 px-3 py-2 sm:px-5 sm:py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {standalone ? <BackButton fallbackHref="/user" /> : null}
            {standalone ? <BrandLogo size="sm" href="/user" reloadDocument /> : null}
            {standalone ? (
              <div className="hidden h-7 w-px bg-slate-200 md:block" aria-hidden="true" />
            ) : null}
            <Breadcrumb className="hidden min-w-0 md:flex" />
          </div>
          {title ? (
            <h1 className="shrink-0 text-base font-bold tracking-snugish text-slate-900 sm:text-lg">{title}</h1>
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
