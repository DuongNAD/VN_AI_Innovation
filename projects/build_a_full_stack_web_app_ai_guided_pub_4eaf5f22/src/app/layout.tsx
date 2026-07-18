import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VN AI Innovation — Trợ lý Thủ tục Hành chính',
  description:
    'Trợ lý AI hướng dẫn người dân và doanh nghiệp thực hiện thủ tục hành chính công: hỏi đáp, giấy tờ, biểu mẫu và kiểm tra trước khi nộp.',
};

/**
 * Mesh nền — màu đủ đậm để mắt thường thấy ngay (vẫn mờ blur).
 * aria-hidden: pure decoration.
 */
function AmbientMesh() {
  return (
    <div className="ambient-mesh" aria-hidden="true">
      <div className="absolute -left-20 -top-16 h-[28rem] w-[28rem] rounded-full bg-brand-400/45 blur-3xl" />
      <div className="absolute -right-10 top-[20%] h-[26rem] w-[26rem] rounded-full bg-sky-300/40 blur-3xl" />
      <div className="absolute bottom-0 left-[25%] h-80 w-80 rounded-full bg-accent-400/35 blur-3xl" />
      <div className="absolute right-[15%] top-[55%] h-72 w-72 rounded-full bg-indigo-300/35 blur-3xl" />
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50 via-surface-muted to-slate-100 font-sans text-body text-slate-900 antialiased">
        <AmbientMesh />
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
