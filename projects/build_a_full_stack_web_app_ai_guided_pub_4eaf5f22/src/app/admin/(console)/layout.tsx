import AuthGate from '@/components/AuthGate';
import UserBar from '@/components/UserBar';

/** Protected admin console — only role=admin. Login lives outside this group. */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate
      allow={['admin']}
      loginPath="/admin/login"
      renderChrome={(user) => (
        <UserBar
          displayName={user.displayName}
          username={user.username}
          roleLabel="Admin"
          homeHref="/admin"
        />
      )}
    >
      {children}
    </AuthGate>
  );
}
