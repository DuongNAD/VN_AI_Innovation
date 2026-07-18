'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs if not provided
  const breadcrumbs = items || generateBreadcrumbs(pathname);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm ${className}`}>
      <Link
        href="/user"
        className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        Trang chủ
      </Link>

      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <div key={index} className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {isLast || !item.href ? (
              <span className="text-slate-900 font-medium" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-slate-500 hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  const pathMap: Record<string, string> = {
    user: 'Người dùng',
    chat: 'Trò chuyện',
    checklist: 'Danh sách giấy tờ',
    form: 'Biểu mẫu',
    result: 'Kết quả',
    manager: 'Người quản lý',
    admin: 'Quản trị',
    sources: 'Nguồn dữ liệu',
    'widget-demo': 'Widget Demo',
    architecture: 'Kiến trúc hệ thống',
  };

  segments.forEach((segment, index) => {
    const label = pathMap[segment] || segment;
    const href = '/' + segments.slice(0, index + 1).join('/');
    breadcrumbs.push({ label, href });
  });

  return breadcrumbs;
}

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
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
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
                  className={`mt-2 text-xs font-medium text-center truncate max-w-[5.5rem] sm:max-w-none ${
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
