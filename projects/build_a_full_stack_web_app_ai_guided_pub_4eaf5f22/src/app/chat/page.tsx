import Link from 'next/link';
import ChatIntake from '@/components/ChatIntake';

export default function ChatPage({
  searchParams,
}: {
  searchParams: { q?: string; procedure?: string; embed?: string };
}) {
  const q = searchParams.q;
  const procedure = searchParams.procedure;
  const embed = searchParams.embed === '1';

  return (
    <div className="flex flex-col min-h-screen">
      {!embed && (
        <header className="p-4 bg-white border-b">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 transition-colors font-medium inline-flex items-center gap-1"
            >
              ← Trang chủ
            </Link>
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