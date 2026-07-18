import { useId } from 'react';
import Link from 'next/link';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  /** null = không bọc Link */
  href?: string | null;
  className?: string;
};

const SIZE_MAP = {
  sm: { box: 'h-8 w-8', mark: 'text-sm', sub: 'text-[9px]' },
  md: { box: 'h-10 w-10', mark: 'text-base', sub: 'text-[10px]' },
  lg: { box: 'h-12 w-12', mark: 'text-lg', sub: 'text-xs' },
} as const;

const BRAND_NAME = 'VN AI Innovation';
const BRAND_TAGLINE = 'Trợ lý Thủ tục Hành chính';
const BRAND_ARIA = 'VN AI Innovation — Trợ lý Thủ tục Hành chính';

/**
 * Logo dự án: con dấu/khiên + hồ sơ số + mạng nơ-ron.
 * Pure presentational — không state / API.
 */
export default function BrandLogo({
  size = 'md',
  iconOnly = false,
  href = '/user',
  className = '',
}: BrandLogoProps) {
  const s = SIZE_MAP[size];
  const uid = useId().replace(/:/g, '');
  const gShield = `logo-shield-${uid}`;
  const gRing = `logo-ring-${uid}`;

  const mark = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`relative flex ${s.box} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 shadow-glow ring-2 ring-accent-400/40`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 40 40" className="h-[78%] w-[78%]" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="15.5" stroke={`url(#${gRing})`} strokeWidth="1.4" fill="none" />
          <circle cx="20" cy="20" r="13.2" stroke="white" strokeOpacity="0.25" strokeWidth="0.8" fill="none" />

          <path
            d="M20 8.2L11 12v7.2c0 5.6 3.9 9.8 9 11.3 5.1-1.5 9-5.7 9-11.3V12L20 8.2z"
            fill={`url(#${gShield})`}
            stroke="white"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          <rect x="15" y="15.5" width="10" height="11" rx="1.2" fill="white" fillOpacity="0.96" />
          <path d="M17.2 18.5h5.6M17.2 21h5.6M17.2 23.5h3.6" stroke="#1d4ed8" strokeWidth="1.15" strokeLinecap="round" />

          <circle cx="27.8" cy="13.2" r="3.6" fill="#f59e0b" stroke="white" strokeWidth="0.9" />
          <path d="M27.8 11.4v3.6M26 13.2h3.6" stroke="white" strokeWidth="1.1" strokeLinecap="round" />

          <circle cx="13.2" cy="26.8" r="1.25" fill="#93c5fd" />
          <circle cx="17" cy="28.6" r="1.1" fill="#bfdbfe" />
          <path d="M13.9 27.3l2.4 1.1" stroke="#93c5fd" strokeWidth="0.85" />

          <defs>
            <linearGradient id={gShield} x1="11" y1="8" x2="29" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3b82f6" />
              <stop offset="1" stopColor="#1e3a5f" />
            </linearGradient>
            <linearGradient id={gRing} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fbbf24" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      {!iconOnly && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className={`${s.mark} font-bold tracking-snugish text-brand-900`}>
            {BRAND_NAME}
          </span>
          <span className={`${s.sub} mt-0.5 font-semibold text-slate-500`}>
            {BRAND_TAGLINE}
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-lg outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-600"
        aria-label={`${BRAND_ARIA} — trang chủ`}
      >
        {mark}
      </Link>
    );
  }

  return (
    <span className="inline-flex" role="img" aria-label={BRAND_ARIA}>
      {mark}
    </span>
  );
}
