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

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-2 text-sm ${className}`}>
      <a
        href="/user"
        className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        Trang chủ
      </a>

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

  const visibleSegments = segments[0] === 'user' ? segments.slice(1) : segments;
  const rootSegments = segments[0] === 'user' ? ['user'] : [];

  visibleSegments.forEach((segment, index) => {
    const label = pathMap[segment] || segment;
    const href = '/' + [...rootSegments, ...visibleSegments.slice(0, index + 1)].join('/');
    breadcrumbs.push({ label, href });
  });

  return breadcrumbs;
}

export { ProgressIndicator } from '@/components/ProgressIndicator';

