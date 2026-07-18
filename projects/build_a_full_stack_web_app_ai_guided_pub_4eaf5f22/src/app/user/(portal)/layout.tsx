import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

export default function UserPortalLayout({ children }: { children: React.ReactNode }) {
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
