import type { Metadata } from 'next';
import './globals.css';
import ChatWidget from '@/components/ChatWidget';

export const metadata: Metadata = {
  title: 'Trợ lý Thủ tục Hành chính',
  description:
    'Trợ lý AI hỗ trợ hướng dẫn và chuẩn bị hồ sơ thủ tục hành chính công tại Việt Nam.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="app-body text-slate-900 font-sans antialiased min-h-screen">
        <div className="relative z-0">{children}</div>
        <ChatWidget />
      </body>
    </html>
  );
}
