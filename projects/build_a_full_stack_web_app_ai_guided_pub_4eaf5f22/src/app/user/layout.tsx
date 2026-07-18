import { headers } from 'next/headers';
import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') || '';
  const isEmbed = h.get('x-embed') === '1';

  // Public routes: login, register, chat AI (guest guidance — no login required)
  if (
    pathname === '/user/login' ||
    pathname.startsWith('/user/login/') ||
    pathname === '/user/register' ||
    pathname.startsWith('/user/register/') ||
    pathname === '/user/chat' ||
    pathname.startsWith('/user/chat/')
  ) {
    // Embed chat: no chrome; full chat page: no AuthGate / UserBar either
    return <>{children}</>;
  }

  // Other embed paths (if any): no UserBar, still auth-gated
  if (isEmbed) {
    return (
      <AuthGate allow={['user']} loginPath="/user/login">
        {children}
      </AuthGate>
    );
  }

  return (
    <AuthGate
      allow={['user']}
      loginPath="/user/login"
      renderChrome={(user) => (
        <UserBar displayName={user.displayName} roleLabel="Công dân" homeHref="/user" />
      )}
    >
      {children}
    </AuthGate>
  );
}
