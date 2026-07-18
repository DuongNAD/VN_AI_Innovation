import ChatIntake from '@/components/ChatIntake';
import FlowChrome from '@/components/FlowChrome';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; procedure?: string; embed?: string }>;
}) {
  const params = await searchParams;
  const q = params.q;
  const procedure = params.procedure;
  const embed = params.embed === '1';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {!embed && <FlowChrome current="chat" title="Trò chuyện với trợ lý AI" />}
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
