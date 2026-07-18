'use client';

import Link from 'next/link';
import { ProgressIndicator } from '@/components/ProgressIndicator';

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
  /** Tiêu đề ngắn của bước hiện tại (tuỳ chọn) */
  title?: string;
  /** Nếu có: hiện nút quay lại ở đầu dải, trỏ tới đường dẫn này */
  backHref?: string;
  /** Nhãn nút quay lại (mặc định "Quay lại") */
  backLabel?: string;
  className?: string;
}

/**
 * Dải tiến trình mảnh cho luồng hồ sơ, nằm ngay dưới UserBar (thanh định danh
 * đã có logo nên ở đây không lặp lại brand). Sticky top-0 — khi cuộn,
 * UserBar trôi đi và dải này ghim lại làm mốc ngữ cảnh.
 * Desktop: tiêu đề + stepper một hàng. Mobile: tiêu đề + chip "Bước x/5"
 * cùng vạch tiến độ mảnh sát mép dưới.
 */
export default function FlowChrome({
  current,
  title,
  backHref,
  backLabel = 'Quay lại',
  className = '',
}: FlowChromeProps) {
  const idx = FLOW_STEPS.findIndex((s) => s.key === current);
  const safeIdx = idx < 0 ? 0 : idx;
  const stepNo = safeIdx + 1;
  const total = FLOW_STEPS.length;

  const steps = FLOW_STEPS.map((s, i) => ({
    label: s.label,
    status: (i < safeIdx ? 'completed' : i === safeIdx ? 'current' : 'upcoming') as
      | 'completed'
      | 'current'
      | 'upcoming',
  }));

  return (
    <div
      className={`no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 ${className}`}
    >
      <div className="relative flex h-14 w-full items-center gap-2.5 px-4 sm:px-6 sm:gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="-ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:pr-3"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="size-5 shrink-0">
              <path
                d="M12.5 5 7.5 10l5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        ) : null}

        {backHref && title ? (
          <span className="hidden h-6 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />
        ) : null}

        {title ? (
          <p
            className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-slate-900 md:flex-none md:max-w-[14rem] xl:max-w-xs"
            title={title}
          >
            {title}
          </p>
        ) : null}

        {/* Stepper đầy đủ — md trở lên */}
        <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
          <ProgressIndicator steps={steps} className="max-w-2xl" />
        </div>

        {/* Chip bước hiện tại — mobile */}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 md:hidden">
          Bước {stepNo}/{total}
          <span className="text-brand-300" aria-hidden="true">
            ·
          </span>
          {FLOW_STEPS[safeIdx].label}
        </span>

        {/* Vạch tiến độ mảnh — mobile */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 md:hidden" aria-hidden="true">
          <div
            className="h-full rounded-r-full bg-brand-600 transition-[width] duration-500"
            style={{ width: `${(stepNo / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
