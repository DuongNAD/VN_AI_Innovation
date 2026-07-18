'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppRole } from '@/lib/roles';
import type { LoginPortal } from '@/components/login/portal';
import { portalHome, portalAccent, safeReturnPath } from '@/components/login/portal';
import BrandLogo from '@/components/BrandLogo';

export type { LoginPortal } from '@/components/login/portal';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20';

type Props = {
  portal: LoginPortal;
  title: string;
  subtitle: string;
};

function loginPath(portal: LoginPortal): string {
  return `${portalHome(portal)}/login`;
}

export default function RegisterForm({ portal, title, subtitle }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already logged in with matching role → portal home
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
        if (data.user.role === portal) {
          router.replace(safeReturnPath(portal) ?? portalHome(portal));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portal, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,50}$/.test(u)) {
      setError('Tên tài khoản 3–50 ký tự, chỉ gồm a-z, 0-9, dấu chấm và gạch dưới.');
      return;
    }
    if (displayName.trim().length < 1 || displayName.trim().length > 100) {
      setError('Họ và tên không hợp lệ.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mật khẩu tối thiểu 8 ký tự, phải có chữ và số.');
      return;
    }
    if (password !== password2) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        username: u,
        password,
        displayName: displayName.trim(),
        portal,
      };
      const em = email.trim();
      if (em) body.email = em;

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Đăng ký thất bại.');
      }
      const role = data?.user?.role as AppRole | undefined;
      if (role !== portal) {
        throw new Error('Đăng ký thất bại.');
      }
      router.replace(safeReturnPath(portal) ?? portalHome(portal));
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  }

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
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-white/70 bg-white/95 p-6 shadow-shell-lg ring-1 ring-slate-900/5 backdrop-blur-sm"
      >
        <div>
          <label htmlFor="reg-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Tên tài khoản
          </label>
          <input
            id="reg-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={INPUT_CLASS}
            placeholder="vd: nguyenvana"
            required
            minLength={3}
            maxLength={50}
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Email <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASS}
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label htmlFor="reg-displayName" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Họ và tên
          </label>
          <input
            id="reg-displayName"
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Nguyễn Văn A"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Mật khẩu
          </label>
          <input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder="••••••••"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-slate-500">Tối thiểu 8 ký tự, có chữ và số.</p>
        </div>

        <div>
          <label htmlFor="reg-password2" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Nhập lại mật khẩu
          </label>
          <input
            id="reg-password2"
            name="password2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className={INPUT_CLASS}
            placeholder="••••••••"
            required
            minLength={8}
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
          {loading ? 'Đang đăng ký…' : 'Đăng ký'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link href={loginPath(portal)} className="font-semibold text-brand-700 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
