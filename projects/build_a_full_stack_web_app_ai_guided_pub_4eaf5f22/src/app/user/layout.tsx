import { headers } from 'next/headers';
import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';
import { getAuthUserFromCookies } from '@/lib/login-auth';

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') || '';
  const isEmbed = h.get('x-embed') === '1';

  // Login / register không hiển thị thanh điều hướng tài khoản.
  if (
    pathname === '/user/login' ||
    pathname.startsWith('/user/login/') ||
    pathname === '/user/register' ||
    pathname.startsWith('/user/register/')
  ) {
    return <>{children}</>;
  }

  const isChat = pathname === '/user/chat' || pathname.startsWith('/user/chat/');

  // Chat vẫn cho khách sử dụng. Nếu đã đăng nhập, giữ UserBar để chuyển trang
  // bằng client navigation không làm mất header của toàn bộ cổng người dùng.
  if (isChat) {
    if (isEmbed) return <>{children}</>;
    const user = await getAuthUserFromCookies();
    return (
      <>
        {user?.role === 'user' ? (
          <UserBar
            displayName={user.displayName}
            username={user.username}
            roleLabel="Công dân"
            homeHref="/user"
          />
        ) : null}
        {children}
      </>
    );
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
        <UserBar
          displayName={user.displayName}
          username={user.username}
          roleLabel="Công dân"
          homeHref="/user"
        />
      )}
    >
      {children}
    </AuthGate>
  );
}
