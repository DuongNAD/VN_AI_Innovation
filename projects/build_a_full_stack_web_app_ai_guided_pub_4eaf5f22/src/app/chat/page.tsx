import Link from 'next/link';
import ChatIntake from '@/components/ChatIntake';
import Breadcrumb from '@/components/Breadcrumb';

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
    <div className="flex flex-col min-h-screen ">
      {!embed && (
        <header className="sticky top-0 z-10 p-4 bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto space-y-3">
            <Breadcrumb />
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900">Trò chuyện với trợ lý AI</h1>
              <Link
                href="/"
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Quay lại
              </Link>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 flex flex-col">
        <ChatIntake
          initialQuery={q}
          initialProcedure={procedure}
          embed={embed}
        />
      </main>
    </div>
  );
}