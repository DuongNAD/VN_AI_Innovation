import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthUserFromCookies, type AuthUser } from '@/lib/login-auth';
import type { AppRole } from '@/lib/roles';

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
 * - Missing session → login
 * - Wrong role → send to that role's own portal (never grant higher privilege)
 */
export default async function AuthGate({ allow, loginPath, children, renderChrome }: Props) {
  const user = await getAuthUserFromCookies();

  if (!user) {
    // Cookie còn nhưng phiên đã hết hạn server-side: giữ đích đến (kể cả
    // query như ?sessionId=…) để sau đăng nhập quay đúng chỗ — middleware chỉ
    // lo được trường hợp thiếu cookie.
    const currentPath = (await headers()).get('x-pathname');
    const next =
      currentPath && currentPath.startsWith('/') && !currentPath.startsWith('//')
        ? `?next=${encodeURIComponent(currentPath)}`
        : '';
    redirect(`${loginPath}${next}`);
  }

  if (!allow.includes(user.role)) {
    // Manager hitting /admin must NOT stay in admin — bounce to manager home
    redirect(homeForRole(user.role));
  }

  return (
    <>
      {renderChrome ? renderChrome(user) : null}
      {children}
    </>
  );
}
