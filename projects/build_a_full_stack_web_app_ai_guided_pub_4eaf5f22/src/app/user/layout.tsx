import { headers } from 'next/headers';
import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') || '';

  // Login page is public (middleware already allows it without cookie)
  if (pathname === '/user/login' || pathname.startsWith('/user/login/')) {
    return <>{children}</>;
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
