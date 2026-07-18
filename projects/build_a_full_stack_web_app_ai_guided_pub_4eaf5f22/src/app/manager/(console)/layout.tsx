import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

/** Protected manager console — only role=manager. */
export default async function ManagerConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate
      allow={['manager']}
      loginPath="/manager/login"
      renderChrome={(user) => (
        <UserBar
          homeHref="/manager"
          user={{
            displayName: user.displayName,
            username: user.username,
            roleLabel: 'Quản lý',
            avatarUrl: user.avatarUrl,
          }}
        />
      )}
    >
      {children}
    </AuthGate>
  );
}
