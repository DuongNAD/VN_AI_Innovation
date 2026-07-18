'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  displayName: string;
  username: string;
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

export default function UserBar({ displayName, username, roleLabel, homeHref }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <header className="relative z-50 flex min-h-[61px] items-center justify-between gap-3 border-b border-white/50 bg-white/85 px-4 py-2 text-sm backdrop-blur-md">
      <Link href={homeHref} className="font-semibold text-slate-800 hover:text-brand-700">
        {portalTitle(homeHref)}
      </Link>

      <div
        className="relative"
        onMouseEnter={() => setMenuOpen(true)}
        onMouseLeave={() => setMenuOpen(false)}
        onFocusCapture={() => setMenuOpen(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMenuOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            event.currentTarget.querySelector<HTMLButtonElement>('[data-account-trigger]')?.focus();
          }
        }}
      >
        <button
          type="button"
          data-account-trigger
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="account-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex min-h-11 max-w-[min(72vw,360px)] items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-slate-800 transition-colors hover:bg-slate-100"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold uppercase text-white shadow-sm"
            aria-hidden="true"
          >
            {displayName.trim().charAt(0) || 'N'}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{displayName}</span>
          </span>
          <span
            className={`ml-0.5 size-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-slate-500 transition-transform ${
              menuOpen ? '-translate-y-0.5 rotate-[225deg]' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full w-[min(320px,calc(100vw-24px))] pt-2">
            <div
              id="account-menu"
              role="menu"
              aria-label="Tùy chọn tài khoản"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold uppercase text-brand-700"
                  aria-hidden="true"
                >
                  {displayName.trim().charAt(0) || 'N'}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-base text-slate-900">{displayName}</strong>
                  <span className="block truncate text-xs text-slate-500">
                    @{username} · {roleLabel}
                  </span>
                </div>
              </div>

              {homeHref === '/user' ? (
                <Link
                  href="/user/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <span
                    className="grid size-8 place-items-center rounded-lg bg-brand-50 text-lg text-brand-700"
                    aria-hidden="true"
                  >
                    ⚙
                  </span>
                  <span>
                    <strong className="block text-sm">Cài đặt tài khoản</strong>
                    <small className="block font-normal text-slate-500">Chỉnh sửa thông tin cá nhân</small>
                  </span>
                </Link>
              ) : null}

              <button
                type="button"
                role="menuitem"
                onClick={logout}
                disabled={busy}
                className="flex min-h-12 w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                <span
                  className="grid size-8 place-items-center rounded-lg bg-slate-100 text-xl"
                  aria-hidden="true"
                >
                  ↪
                </span>
                <span>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
