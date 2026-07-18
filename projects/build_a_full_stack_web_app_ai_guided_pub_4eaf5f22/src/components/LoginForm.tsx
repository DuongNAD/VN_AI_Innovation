'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppRole } from '@/lib/roles';
import type { LoginPortal } from '@/components/login/portal';
import { portalHome, portalAccent, safeReturnPath } from '@/components/login/portal';
import { GoogleIcon, VnidIcon } from '@/components/login/SocialIcons';
import BrandLogo from '@/components/BrandLogo';

export type { LoginPortal } from '@/components/login/portal';

/** Module-level constants — identical on server & client (no hydration drift). */
const USERNAME_PLACEHOLDER = 'Tài khoản hoặc email';
const PASSWORD_PLACEHOLDER = '••••••••';
const GENERIC_AUTH_ERROR = 'Tài khoản hoặc mật khẩu không đúng.';

const LS_FAILED_ATTEMPTS = 'loginFailedAttempts';
const LS_LOCK_EXPIRATION = 'loginLockExpiration';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 300_000; // 5 phút

type Props = {
  portal: LoginPortal;
  title: string;
  subtitle: string;
  /** Enable Google / VNeID (citizen portal only) */
  socialEnabled?: boolean;
};

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function readLockExpiration(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LS_LOCK_EXPIRATION);
  if (!raw) return null;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return ts;
}

function readFailedAttempts(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(LS_FAILED_ATTEMPTS);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function clearLockStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_FAILED_ATTEMPTS);
  localStorage.removeItem(LS_LOCK_EXPIRATION);
}

function writeFailedAttempts(n: number): void {
  localStorage.setItem(LS_FAILED_ATTEMPTS, String(n));
}

function writeLockExpiration(ts: number): void {
  localStorage.setItem(LS_LOCK_EXPIRATION, String(ts));
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

  /** Khóa client-side: hết hạn (epoch ms) hoặc null nếu không khóa */
  const [lockExpiration, setLockExpiration] = useState<number | null>(null);
  /** Giây còn lại — cập nhật mỗi giây khi đang khóa */
  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  const isLocked = lockExpiration != null && lockRemainingSec > 0;

  const unlockForm = useCallback(() => {
    clearLockStorage();
    setLockExpiration(null);
    setLockRemainingSec(0);
  }, []);

  // Khôi phục trạng thái khóa từ localStorage (sau F5 / mở lại tab)
  useEffect(() => {
    const exp = readLockExpiration();
    if (exp == null) {
      // Đồng bộ attempts nếu còn; không khóa
      return;
    }
    const remainingMs = exp - Date.now();
    if (remainingMs <= 0) {
      unlockForm();
      return;
    }
    setLockExpiration(exp);
    setLockRemainingSec(Math.ceil(remainingMs / 1000));
  }, [unlockForm]);

  // Đếm ngược MM:SS mỗi giây
  useEffect(() => {
    if (lockExpiration == null) return;

    const tick = () => {
      const remainingMs = lockExpiration - Date.now();
      if (remainingMs <= 0) {
        unlockForm();
        setError(null);
        return;
      }
      setLockRemainingSec(Math.ceil(remainingMs / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockExpiration, unlockForm]);

  /** Ghi nhận 1 lần thất bại; khóa form sau đúng 5 lần liên tiếp. */
  const recordFailedAttempt = useCallback((serverMessage?: string) => {
    const current = readFailedAttempts() + 1;
    if (current >= MAX_FAILED_ATTEMPTS) {
      const exp = Date.now() + LOCKOUT_MS;
      writeFailedAttempts(MAX_FAILED_ATTEMPTS);
      writeLockExpiration(exp);
      setLockExpiration(exp);
      setLockRemainingSec(Math.ceil(LOCKOUT_MS / 1000));
      setError(
        `Bạn đã nhập sai quá nhiều lần. Form bị khóa ${formatMmSs(LOCKOUT_MS / 1000)}.`
      );
      return;
    }
    writeFailedAttempts(current);
    const left = MAX_FAILED_ATTEMPTS - current;
    const base = serverMessage?.trim() || GENERIC_AUTH_ERROR;
    setError(`${base} (Còn ${left} lần thử trước khi khóa tạm thời.)`);
  }, []);

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
          unlockForm();
          router.replace(safeReturnPath(portal) ?? portalHome(portal));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, router, unlockForm]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;

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
        const serverMsg =
          typeof data?.error?.message === 'string' ? data.error.message : GENERIC_AUTH_ERROR;
        const code = typeof data?.error?.code === 'string' ? data.error.code : '';
        // Infrastructure failures (DB down, 5xx) must not burn lockout attempts.
        if (
          res.status >= 500 ||
          code === 'SERVICE_UNAVAILABLE' ||
          code === 'INTERNAL_ERROR' ||
          code === 'RATE_LIMITED'
        ) {
          setError(serverMsg);
          return;
        }
        recordFailedAttempt(serverMsg);
        return;
      }
      // Defense in depth: never navigate if server returned a mismatched role.
      // Generic message — don't disclose what role the account actually has.
      const role = data?.user?.role as AppRole | undefined;
      if (role !== portal) {
        recordFailedAttempt(GENERIC_AUTH_ERROR);
        return;
      }
      unlockForm();
      router.replace(safeReturnPath(portal) ?? portalHome(portal));
      router.refresh();
    } catch (err: unknown) {
      recordFailedAttempt(err instanceof Error ? err.message : GENERIC_AUTH_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function startVnid() {
    if (isLocked) return;
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
            unlockForm();
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
    if (!vnidId || isLocked) return;
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
      const st = await fetch(`/api/v1/auth/vnid/${vnidId}/status`, { credentials: 'include' });
      const body = await st.json();
      if (body.status === 'CONFIRMED' || body.status === 'CONSUMED' || body.user) {
        stopPoll();
        unlockForm();
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

  const inputDisabledClass = isLocked
    ? ' opacity-60 cursor-not-allowed bg-slate-50'
    : '';

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <BrandLogo size="lg" href={null} />
        </div>
        <div className="space-y-2">
          <div
            className={`mx-auto inline-flex rounded-full bg-gradient-to-r ${portalAccent(portal)} px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm`}
          >
            {portal === 'user' ? 'Công dân' : portal === 'manager' ? 'Quản lý' : 'Quản trị'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
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
            className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20${inputDisabledClass}`}
            placeholder={USERNAME_PLACEHOLDER}
            required
            disabled={isLocked || loading}
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
              className={`w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20${inputDisabledClass}`}
              placeholder={PASSWORD_PLACEHOLDER}
              required
              disabled={isLocked || loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={isLocked || loading}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
        </div>

        {isLocked && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm text-amber-900"
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold">Form tạm khóa do đăng nhập sai nhiều lần</p>
            <p className="mt-1 tabular-nums text-lg font-bold tracking-wide text-amber-800">
              {formatMmSs(lockRemainingSec)}
            </p>
            <p className="mt-1 text-xs text-amber-700">Vui lòng thử lại sau khi hết thời gian chờ.</p>
          </div>
        )}

        {error && !isLocked && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </div>
        )}

        {error && isLocked && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isLocked}
          className={`w-full rounded-xl bg-gradient-to-r ${portalAccent(portal)} py-3 font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60`}
        >
          {isLocked
            ? `Khóa tạm — ${formatMmSs(lockRemainingSec)}`
            : loading
              ? 'Đang đăng nhập…'
              : 'Đăng nhập'}
        </button>

        {portal === 'user' ? (
          <p className="text-center text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <Link
              href={`${portalHome(portal)}/register`}
              className="font-semibold text-brand-700 hover:underline"
            >
              Đăng ký
            </Link>
          </p>
        ) : (
          <p className="text-center text-xs text-slate-500">
            Tài khoản cán bộ do quản trị viên cấp — không tự đăng ký.
          </p>
        )}
      </form>

      {socialEnabled && (
        <div className="space-y-3 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-shell ring-1 ring-slate-900/5">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hoặc đăng nhập nhanh
          </p>
          <div className="grid grid-cols-1 gap-2">
            <a
              href="/api/v1/auth/oauth/google/start?portal=user"
              className={`flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${isLocked ? 'pointer-events-none opacity-60' : ''}`}
              aria-disabled={isLocked}
              onClick={(e) => {
                if (isLocked) e.preventDefault();
              }}
            >
              <GoogleIcon />
              Google
            </a>
          </div>
          <button
            type="button"
            onClick={startVnid}
            disabled={isLocked}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <VnidIcon />
            Quét mã QR VNeID
          </button>

          {showVnid && !isLocked && (
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
