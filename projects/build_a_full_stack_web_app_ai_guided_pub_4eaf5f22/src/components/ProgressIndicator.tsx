'use client';

// Progress Indicator Component
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
    <div className={`w-full ${className}`}>
      <ol
        className="flex items-center justify-between"
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
              className="flex items-center flex-1 min-w-0"
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              <div className="flex flex-col items-center min-w-0">
                <div
                  className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                    step.status === 'completed'
                      ? 'bg-green-600 text-white'
                      : step.status === 'current'
                      ? 'bg-blue-700 text-white ring-4 ring-blue-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                  aria-hidden="true"
                >
                  {step.status === 'completed' ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1.5 max-w-[5.5rem] truncate text-center text-xs font-medium sm:max-w-none ${
                    step.status === 'current' ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                  <span className="sr-only"> ({statusLabel})</span>
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-1 mx-2 rounded transition-all ${
                    step.status === 'completed' ? 'bg-green-600' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
