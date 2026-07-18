'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';

type Props = {
  displayName: string;
  username: string;
  roleLabel: string;
  homeHref: string;
};

type PortalTheme = {
  title: string;
  caption: string;
  badge: string;
  avatar: string;
  panel: string;
  icon: React.ReactNode;
};

function portalTheme(homeHref: string): PortalTheme {
  if (homeHref === '/admin') {
    return {
      title: 'Cổng quản trị',
      caption: 'Điều hành hệ thống',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      avatar: 'from-amber-500 to-orange-600 shadow-amber-500/25',
      panel: 'from-amber-50 via-white to-orange-50',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4.5 6v5.3c0 4.7 3.1 8.3 7.5 9.7 4.4-1.4 7.5-5 7.5-9.7V6L12 3Z" />
          <path d="m9.2 12 1.8 1.8 4-4" />
        </svg>
      ),
    };
  }

  if (homeHref === '/manager') {
    return {
      title: 'Cổng quản lý',
      caption: 'Theo dõi & xét duyệt',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
      avatar: 'from-violet-500 to-indigo-600 shadow-violet-500/25',
      panel: 'from-violet-50 via-white to-indigo-50',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h16M6 17V9h4v8m4 0V4h4v13" />
          <path d="m6 6 4-3 4 2 4-3" />
        </svg>
      ),
    };
  }

  return {
    title: 'Cổng người dùng',
    caption: 'Dịch vụ công trực tuyến',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    avatar: 'from-blue-500 to-indigo-600 shadow-blue-500/25',
    panel: 'from-blue-50 via-white to-indigo-50',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" />
      </svg>
    ),
  };
}

function loginPath(homeHref: string): string {
  if (homeHref === '/manager') return '/manager/login';
  if (homeHref === '/admin') return '/admin/login';
  return '/user/login';
}

function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'N';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" />
    </svg>
  );
}

export default function UserBar({ displayName, username, roleLabel, homeHref }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = portalTheme(homeHref);
  const userInitials = initials(displayName);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
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

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 text-sm shadow-[0_1px_0_rgba(255,255,255,0.8),0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-2.5 px-3 sm:px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          {pathname !== homeHref ? <BackButton fallbackHref={homeHref} /> : null}

          <span className="hidden sm:inline-flex">
            <BrandLogo size="sm" href={homeHref} />
          </span>
          <span className="inline-flex sm:hidden">
            <BrandLogo size="sm" iconOnly href={homeHref} />
          </span>

          <span className="hidden h-7 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent sm:block" aria-hidden="true" />

          <Link
            href={homeHref}
            className={`group flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${theme.badge}`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/80 shadow-sm ring-1 ring-current/10 [&_svg]:size-4 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round">
              {theme.icon}
            </span>
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[13px] font-bold sm:text-sm">{theme.title}</strong>
              <span className="hidden truncate text-[10px] font-medium opacity-70 md:block">{theme.caption}</span>
            </span>
          </Link>
        </div>

        <div
          ref={menuRef}
          className="relative shrink-0"
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
            aria-label={`Mở menu tài khoản của ${displayName}`}
            onClick={() => setMenuOpen((open) => !open)}
            className={`group flex min-h-11 max-w-[min(58vw,330px)] items-center gap-2 rounded-xl border px-1.5 py-1 text-left transition-all duration-200 ${
              menuOpen
                ? 'border-slate-200 bg-white shadow-lg shadow-slate-900/10'
                : 'border-transparent hover:border-slate-200 hover:bg-white hover:shadow-md hover:shadow-slate-900/5'
            }`}
          >
            <span className={`relative grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-xs font-extrabold uppercase text-white shadow-lg ${theme.avatar}`} aria-hidden="true">
              {userInitials}
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>

            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Xin chào</span>
              <strong className="block truncate text-sm font-bold text-slate-800">{displayName}</strong>
            </span>

            <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition-all group-hover:bg-slate-100 ${menuOpen ? 'bg-slate-100 text-slate-800' : ''}`} aria-hidden="true">
              <svg className={`size-4 fill-none stroke-current stroke-2 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24">
                <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[min(350px,calc(100vw-24px))]">
              <span className="absolute -top-1.5 right-6 size-3 rotate-45 border-l border-t border-slate-200 bg-white" aria-hidden="true" />
              <div
                id="account-menu"
                role="menu"
                aria-label="Tùy chọn tài khoản"
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.28)]"
              >
                <div className={`bg-gradient-to-br px-4 py-4 ${theme.panel}`}>
                  <div className="flex items-center gap-3.5">
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-base font-extrabold uppercase text-white shadow-lg ${theme.avatar}`} aria-hidden="true">
                      {userInitials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base font-bold text-slate-900">{displayName}</strong>
                      <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">@{username}</span>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${theme.badge}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 p-2">
                  <Link
                    href={homeHref}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-700"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600 [&_svg]:size-5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round" aria-hidden="true">
                      <HomeIcon />
                    </span>
                    <span>
                      <strong className="block text-sm">Trang chủ {theme.title.toLowerCase()}</strong>
                      <small className="block font-normal text-slate-500">Quay lại không gian làm việc</small>
                    </span>
                  </Link>

                  {homeHref === '/user' ? (
                    <Link
                      href="/user/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700 [&_svg]:size-5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round" aria-hidden="true">
                        <SettingsIcon />
                      </span>
                      <span>
                        <strong className="block text-sm">Cài đặt tài khoản</strong>
                        <small className="block font-normal text-slate-500">Chỉnh sửa thông tin cá nhân</small>
                      </span>
                    </Link>
                  ) : null}
                </div>

                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    disabled={busy}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600 [&_svg]:size-5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round" aria-hidden="true">
                      <LogoutIcon />
                    </span>
                    <span>
                      <strong className="block text-sm">{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</strong>
                      <small className="block font-normal text-slate-500">Kết thúc phiên làm việc hiện tại</small>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
