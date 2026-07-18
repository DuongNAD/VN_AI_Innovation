'use client';

// Stepper ngang một hàng: số/tick + nhãn nằm cạnh nhau, nối bằng vạch mảnh.
// Dưới lg chỉ hiện nhãn của bước hiện tại để không tràn dòng.
interface ProgressStep {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  className?: string;
}

export function ProgressIndicator({ steps, className = '' }: ProgressIndicatorProps) {
  return (
    <ol
      className={`flex w-full items-center ${className}`}
      role="list"
      aria-label="Tiến trình hồ sơ"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const statusLabel =
          step.status === 'completed'
            ? 'đã hoàn thành'
            : step.status === 'current'
            ? 'đang thực hiện'
            : 'chưa tới';

        return (
          <li
            key={index}
            className={`flex items-center ${isLast ? 'shrink-0' : 'min-w-0 flex-1'}`}
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            <span className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : step.status === 'current'
                    ? 'bg-white text-brand-700 ring-2 ring-brand-600 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]'
                    : 'bg-white text-slate-400 ring-1 ring-slate-300'
                }`}
              >
                {step.status === 'completed' ? (
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>

              <span
                className={`whitespace-nowrap text-[13px] transition-colors duration-300 ${
                  step.status === 'current'
                    ? 'font-semibold text-slate-900'
                    : step.status === 'completed'
                    ? 'hidden font-medium text-slate-600 lg:inline'
                    : 'hidden font-medium text-slate-400 lg:inline'
                }`}
              >
                {step.label}
                <span className="sr-only"> ({statusLabel})</span>
              </span>
            </span>

            {!isLast && (
              <span
                aria-hidden="true"
                className={`mx-2 h-0.5 min-w-4 flex-1 rounded-full transition-colors duration-500 lg:mx-3 ${
                  step.status === 'completed' ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
