import { headers } from 'next/headers';
import UserBar from '@/components/UserBar';
import { getAuthUserFromCookies } from '@/lib/login-auth';

/**
 * Chat vẫn mở cho khách (middleware xếp /user/chat vào nhóm public), nhưng nếu
 * công dân đã đăng nhập thì giữ UserBar để điều hướng không làm mất header của
 * cổng người dùng. Widget nhúng (?embed=1 → header x-embed) hiển thị trần.
 */
export default async function UserChatLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  if (h.get('x-embed') === '1') {
    return <>{children}</>;
  }

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
