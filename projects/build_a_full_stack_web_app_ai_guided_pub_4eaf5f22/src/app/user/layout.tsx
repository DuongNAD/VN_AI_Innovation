import { headers } from 'next/headers';
import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') || '';
  const isEmbed = h.get('x-embed') === '1';

  // Login page is public (middleware already allows it without cookie)
  if (pathname === '/user/login' || pathname.startsWith('/user/login/')) {
    return <>{children}</>;
  }

  // Widget iframe (?embed=1): keep auth gate, omit chrome UserBar
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
