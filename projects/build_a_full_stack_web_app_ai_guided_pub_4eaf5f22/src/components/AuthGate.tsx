import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  getAuthUserFromToken,
  LOGIN_COOKIE,
  type AuthUser,
} from '@/lib/login-auth';
import { isDbConnectivityError, withDbRetry } from '@/lib/db';
import type { AppRole } from '@/lib/roles';
import DbReconnectBanner from '@/components/DbReconnectBanner';

type Props = {
  /** Roles allowed to view children — typically a single role per portal */
  allow: AppRole[];
  loginPath: string;
  children: React.ReactNode;
  /** Optional render prop for toolbar */
  renderChrome?: (user: AuthUser) => React.ReactNode;
};

function homeForRole(role: AppRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/user';
}

/**
 * Server-side gate for portal pages.
 * - Missing cookie → login
 * - Cookie present but DB temporarily down → keep session, show reconnect UI
 *   (do NOT bounce to login and burn lockout attempts)
 * - Invalid/expired session → login
 * - Wrong role → that role's own portal
 */
export default async function AuthGate({ allow, loginPath, children, renderChrome }: Props) {
  const jar = await cookies();
  const token = jar.get(LOGIN_COOKIE)?.value ?? null;

  if (!token) {
    redirect(loginPath);
  }

  let user: AuthUser | null = null;
  let dbDown = false;

  try {
    user = await withDbRetry(() => getAuthUserFromToken(token), {
      retries: 3,
      delayMs: 350,
      label: 'auth-gate',
    });
  } catch (err) {
    if (isDbConnectivityError(err)) {
      dbDown = true;
      console.error('[AuthGate] database unavailable while session cookie present:', err);
    } else {
      console.error('[AuthGate] unexpected auth error:', err);
      // Non-connectivity errors: safest is login
      redirect(loginPath);
    }
  }

  if (dbDown) {
    // Cookie still held by the browser — user can retry without re-entering password.
    return <DbReconnectBanner loginPath={loginPath} />;
  }

  if (!user) {
    // Token present but session invalid/expired in DB
    redirect(loginPath);
  }

  if (!allow.includes(user.role)) {
    redirect(homeForRole(user.role));
  }

  return (
    <>
      {renderChrome ? renderChrome(user) : null}
      {children}
    </>
  );
}
