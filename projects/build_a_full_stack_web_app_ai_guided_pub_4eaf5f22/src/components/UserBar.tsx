'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  displayName: string;
  roleLabel: string;
  homeHref: string;
};

function portalTitle(homeHref: string): string {
  if (homeHref === '/manager') return 'Cổng quản lý';
  if (homeHref === '/admin') return 'Cổng quản trị';
  return 'Cổng người dùng';
}

function loginPath(homeHref: string): string {
  if (homeHref === '/manager') return '/manager/login';
  if (homeHref === '/admin') return '/admin/login';
  return '/user/login';
}

export default function UserBar({ displayName, roleLabel, homeHref }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace(loginPath(homeHref));
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/50 bg-white/80 px-4 py-2 text-sm backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Link href={homeHref} className="font-semibold text-slate-800 hover:text-brand-700">
          {portalTitle(homeHref)}
        </Link>
        <span className="hidden text-slate-300 sm:inline">|</span>
        <span className="text-slate-600">
          Xin chào, <strong className="text-slate-900">{displayName}</strong>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {roleLabel}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {homeHref === '/user' ? (
          <Link
            href="/user/profile"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1 font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100"
          >
            <span
              className="grid size-7 place-items-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white"
              aria-hidden="true"
            >
              {displayName.trim().charAt(0) || 'N'}
            </span>
            <span className="hidden sm:inline">Sửa thông tin</span>
            <span className="sm:hidden">Hồ sơ</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? '…' : 'Đăng xuất'}
        </button>
      </div>
    </div>
  );
}
