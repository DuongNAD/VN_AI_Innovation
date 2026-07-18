'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

type AccountInfo = {
  displayName: string;
  username: string;
  roleLabel: string;
  avatarUrl?: string | null;
};

type Props = {
  homeHref: string;
  /** null = khách (chưa đăng nhập) — hiện nút Đăng nhập thay cho menu tài khoản */
  user: AccountInfo | null;
  /** Đường dẫn quay lại sau khi khách đăng nhập (gắn vào ?next=) */
  loginNext?: string;
};

const PORTAL_META: Record<string, { label: string; chip: string }> = {
  '/manager': { label: 'Cổng quản lý · Duyệt đơn', chip: 'border-sky-200/70 bg-sky-50 text-sky-700' },
  '/admin': { label: 'Cổng quản trị', chip: 'border-amber-200/70 bg-amber-50 text-amber-800' },
  '/user': { label: 'Cổng người dùng', chip: 'border-brand-100 bg-brand-50 text-brand-700' },
};

function portalMeta(homeHref: string) {
  return PORTAL_META[homeHref] ?? PORTAL_META['/user'];
}

function loginPath(homeHref: string): string {
  if (homeHref === '/manager') return '/manager/login';
  if (homeHref === '/admin') return '/admin/login';
  return '/user/login';
}

function Avatar({
  user,
  size,
  className = '',
}: {
  user: AccountInfo;
  size: 'sm' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'size-9 text-sm' : 'size-11 text-base';
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${box} shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold uppercase text-white ring-2 ring-white shadow-sm ${className}`}
    >
      {user.displayName.trim().charAt(0) || 'N'}
    </span>
  );
}

/**
 * Thanh định danh dùng chung cho mọi cổng: logo + chip phân hệ bên trái,
 * menu tài khoản (hoặc nút Đăng nhập cho khách) bên phải.
 * Cao đúng h-16 để FlowChrome có thể nối liền bên dưới.
 */
export default function UserBar({ homeHref, user, loginNext }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const portal = portalMeta(homeHref);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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

  const loginHref = loginNext
    ? `${loginPath(homeHref)}?next=${encodeURIComponent(loginNext)}`
    : loginPath(homeHref);

  return (
    <header className="no-print relative z-50 border-b border-slate-200/70 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo size="sm" href={homeHref} />
          <span className="hidden h-6 w-px bg-slate-200 md:block" aria-hidden="true" />
          <span
            className={`hidden shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold md:inline-flex ${portal.chip}`}
          >
            {portal.label}
          </span>
        </div>

        {user ? (
          <div className="relative shrink-0" ref={rootRef}>
            <button
              type="button"
              ref={triggerRef}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={`flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-slate-100 ${
                menuOpen ? 'bg-slate-100' : ''
              }`}
            >
              <Avatar user={user} size="sm" />
              <span className="hidden max-w-[11rem] truncate text-sm font-semibold text-slate-800 sm:block lg:max-w-[15rem]">
                {user.displayName}
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className={`size-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                  menuOpen ? 'rotate-180' : ''
                }`}
              >
                <path
                  d="M5.5 7.5 10 12l4.5-4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {menuOpen ? (
              <div
                id="account-menu"
                role="menu"
                aria-label="Tùy chọn tài khoản"
                className="menu-pop absolute right-0 top-full mt-2 w-[min(300px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-slate-900/5"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
                  <Avatar user={user} size="lg" />
                  <div className="min-w-0">
                    <strong className="block truncate text-[15px] font-semibold text-slate-900">
                      {user.displayName}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      @{user.username} · {user.roleLabel}
                    </span>
                  </div>
                </div>

                <div className="p-1.5">
                  {homeHref === '/user' ? (
                    <Link
                      href="/user/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px] text-slate-400">
                        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
                        <path
                          d="M5.5 19c.8-3 3.4-4.6 6.5-4.6s5.7 1.6 6.5 4.6"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                      Cài đặt tài khoản
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    disabled={busy}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px] text-slate-400">
                      <path
                        d="M14 6V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10 12h10m0 0-3-3m3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            href={loginHref}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}
