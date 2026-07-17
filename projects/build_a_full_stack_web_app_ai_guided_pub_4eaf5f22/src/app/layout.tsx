import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trợ lý Thủ tục Hành chính',
  description: 'Trợ lý AI hỗ trợ hướng dẫn và chuẩn bị hồ sơ thủ tục hành chính công tại Việt Nam.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-50 text-slate-900 text-[17px] md:text-lg font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}