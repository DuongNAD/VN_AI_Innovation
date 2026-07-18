'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppRole } from '@/lib/roles';
import type { LoginPortal } from '@/components/login/portal';
import { portalHome, portalAccent, safeReturnPath } from '@/components/login/portal';
import { GoogleIcon, FacebookIcon, VnidIcon } from '@/components/login/SocialIcons';

export type { LoginPortal } from '@/components/login/portal';

/** Module-level constants — identical on server & client (no hydration drift). */
const USERNAME_PLACEHOLDER = 'Tài khoản hoặc email';
const PASSWORD_PLACEHOLDER = '••••••••';
const GENERIC_AUTH_ERROR = 'Tài khoản hoặc mật khẩu không đúng.';

type Props = {
  portal: LoginPortal;
  title: string;
  subtitle: string;
  /** Enable Google / Facebook / VNeID (citizen portal only) */
  socialEnabled?: boolean;
};

export default function LoginForm({
  portal,
  title,
  subtitle,
  socialEnabled = false,
}: Props) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVnid, setShowVnid] = useState(false);
  const [vnidPayload, setVnidPayload] = useState<string | null>(null);
  const [vnidId, setVnidId] = useState<string | null>(null);
  const [vnidStatus, setVnidStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  // Only auto-enter portal when session role matches this portal exactly (1:1)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: { role: AppRole } | null;
        };
        if (cancelled || !data.authenticated || !data.user) return;
        const role = data.user.role;
        if (role === portal) {
          router.replace(safeReturnPath(portal) ?? portalHome(portal));
        }
        // Wrong role (e.g. manager on /admin/login): stay on form, do not open admin
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, router]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, portal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || GENERIC_AUTH_ERROR);
      }
      // Defense in depth: never navigate if server returned a mismatched role
      const role = data?.user?.role as AppRole | undefined;
      if (role !== portal) {
        throw new Error(GENERIC_AUTH_ERROR);
      }
      router.replace(safeReturnPath(portal) ?? portalHome(portal));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : GENERIC_AUTH_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function startVnid() {
    setError(null);
    setShowVnid(true);
    setVnidStatus('PENDING');
    stopPoll();
    try {
      const res = await fetch('/api/v1/auth/vnid/start', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Không tạo được mã QR VNeID.');
      setVnidId(data.challengeId);
      setVnidPayload(data.qrPayload);

      pollRef.current = setInterval(async () => {
        if (!data.challengeId) return;
        try {
          const st = await fetch(`/api/v1/auth/vnid/${data.challengeId}/status`, {
            credentials: 'include',
          });
          const body = await st.json();
          setVnidStatus(body.status);
          if (body.status === 'CONFIRMED' && body.user) {
            stopPoll();
            router.replace('/user?logged_in=1&via=vnid');
            router.refresh();
          }
          if (body.status === 'EXPIRED' || body.status === 'CANCELLED') {
            stopPoll();
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi VNeID.');
      setShowVnid(false);
    }
  }

  async function simulateVnidScan() {
    if (!vnidId) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/auth/vnid/${vnidId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Xác nhận VNeID thất bại.');
      setVnidStatus('CONFIRMED');
      // Next poll will set cookie via status endpoint
      const st = await fetch(`/api/v1/auth/vnid/${vnidId}/status`, { credentials: 'include' });
      const body = await st.json();
      if (body.status === 'CONFIRMED' || body.status === 'CONSUMED' || body.user) {
        stopPoll();
        router.replace('/user?logged_in=1&via=vnid');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mô phỏng quét thất bại.');
    }
  }

  const qrImg =
    vnidPayload != null
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(vnidPayload)}`
      : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <div
          className={`mx-auto inline-flex rounded-full bg-gradient-to-r ${portalAccent(portal)} px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm`}
        >
          {portal === 'user' ? 'Công dân' : portal === 'manager' ? 'Manager' : 'Admin'}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>

      <form
        onSubmit={handlePasswordLogin}
        className="space-y-4 rounded-2xl border border-white/70 bg-white/95 p-6 shadow-shell-lg ring-1 ring-slate-900/5 backdrop-blur-sm"
      >
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Tài khoản hoặc email
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
            placeholder={USERNAME_PLACEHOLDER}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Mật khẩu
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
            placeholder={PASSWORD_PLACEHOLDER}
            required
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-xl bg-gradient-to-r ${portalAccent(portal)} py-3 font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60`}
        >
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Chưa có tài khoản?{' '}
          <Link
            href={`${portalHome(portal)}/register`}
            className="font-semibold text-brand-700 hover:underline"
          >
            Đăng ký
          </Link>
        </p>
      </form>

      {socialEnabled && (
        <div className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-shell ring-1 ring-slate-900/5">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hoặc đăng nhập nhanh
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href="/api/v1/auth/oauth/google/start?portal=user"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <GoogleIcon />
              Google
            </a>
            <a
              href="/api/v1/auth/oauth/facebook/start?portal=user"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <FacebookIcon />
              Facebook
            </a>
          </div>
          <button
            type="button"
            onClick={startVnid}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            <VnidIcon />
            Quét mã QR VNeID
          </button>

          {showVnid && (
            <div className="mt-2 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-slate-700">
                Mở app VNeID trên điện thoại và quét mã
              </p>
              {qrImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImg}
                  alt="Mã QR đăng nhập VNeID"
                  width={200}
                  height={200}
                  className="mx-auto rounded-lg border border-slate-200 bg-white p-2"
                />
              ) : (
                <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                  Đang tạo mã…
                </div>
              )}
              <p className="text-xs text-slate-500">
                Trạng thái: <span className="font-semibold">{vnidStatus ?? '…'}</span>
              </p>
              <button
                type="button"
                onClick={simulateVnidScan}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Mô phỏng quét thành công (demo)
              </button>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Môi trường demo không kết nối CSDLQG/VNeID thật. Nút trên giả lập công dân phê duyệt
                trên điện thoại.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
