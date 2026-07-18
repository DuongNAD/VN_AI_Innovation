'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppRole } from '@/lib/roles';

export type LoginPortal = 'user' | 'manager' | 'admin';

/** Module-level constants — identical on server & client (no hydration drift). */
const USERNAME_PLACEHOLDER = 'Tài khoản hoặc email';
const PASSWORD_PLACEHOLDER = '••••••••';

type Props = {
  portal: LoginPortal;
  title: string;
  subtitle: string;
  /** Enable Google / Facebook / VNeID (citizen portal only) */
  socialEnabled?: boolean;
};

function portalHome(portal: LoginPortal): string {
  if (portal === 'user') return '/user';
  if (portal === 'manager') return '/manager';
  return '/admin';
}

function portalAccent(portal: LoginPortal): string {
  if (portal === 'admin') return 'from-amber-600 to-orange-500';
  if (portal === 'manager') return 'from-sky-600 to-indigo-500';
  return 'from-brand-600 to-sky-500';
}

export default function LoginForm({
  portal,
  title,
  subtitle,
  socialEnabled = false,
}: Props) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          router.replace(portalHome(portal));
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
        throw new Error(data?.error?.message || 'Đăng nhập thất bại.');
      }
      // Defense in depth: never navigate if server returned a mismatched role.
      // Generic message — don't disclose what role the account actually has.
      const role = data?.user?.role as AppRole | undefined;
      if (role !== portal) {
        throw new Error('Đăng nhập thất bại.');
      }
      router.replace(portalHome(portal));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
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
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
              placeholder={PASSWORD_PLACEHOLDER}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            >
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
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

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!visible && <path d="m4 4 16 16" />}
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-1.6 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z" />
    </svg>
  );
}

function VnidIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v1m6 11h2m-6 0h-2v4m0-11V9a3 3 0 00-3-3H7a3 3 0 00-3 3v1m14 0V9a3 3 0 00-3-3h-1m-4 8a2 2 0 100-4 2 2 0 000 4z"
      />
    </svg>
  );
}
