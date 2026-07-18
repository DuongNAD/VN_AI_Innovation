'use client';

import { useRouter } from 'next/navigation';

type BackButtonProps = {
  fallbackHref: string;
  className?: string;
};

export default function BackButton({ fallbackHref, className = '' }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Quay lại trang trước"
      title="Quay lại"
      className={`group grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition-all hover:-translate-x-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 [&_svg]:size-[18px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14.5 5-7 7 7 7" />
        <path d="M8 12h11" />
      </svg>
    </button>
  );
}
