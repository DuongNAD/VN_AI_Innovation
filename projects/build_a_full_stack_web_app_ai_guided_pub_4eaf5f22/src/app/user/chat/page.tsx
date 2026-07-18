import ChatIntake from '@/components/ChatIntake';
import FlowChrome from '@/components/FlowChrome';
import UserBar from '@/components/UserBar';
import { getAuthUserFromCookies } from '@/lib/login-auth';
import type { AppRole } from '@/lib/roles';

const ROLE_LABELS: Record<AppRole, string> = {
  user: 'Công dân',
  manager: 'Quản lý',
  admin: 'Quản trị viên',
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; procedure?: string; embed?: string }>;
}) {
  const params = await searchParams;
  const q = params.q;
  const procedure = params.procedure;
  const embed = params.embed === '1';

  // Chat mở cho khách — chỉ tra phiên để hiện đúng trạng thái tài khoản trên thanh định danh.
  const authUser = embed ? null : await getAuthUserFromCookies();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {!embed && (
        <>
          <UserBar
            homeHref="/user"
            loginNext="/user/chat"
            user={
              authUser
                ? {
                    displayName: authUser.displayName,
                    username: authUser.username,
                    roleLabel: ROLE_LABELS[authUser.role],
                    avatarUrl: authUser.avatarUrl,
                  }
                : null
            }
          />
          <FlowChrome current="chat" title="Trò chuyện với trợ lý AI" />
        </>
      )}
      <main
        id="main-content"
        className={`flex min-h-0 flex-1 flex-col ${embed ? '' : 'p-3 sm:p-4'}`}
      >
        <ChatIntake
          initialQuery={q}
          initialProcedure={procedure}
          embed={embed}
        />
      </main>
    </div>
  );
}
