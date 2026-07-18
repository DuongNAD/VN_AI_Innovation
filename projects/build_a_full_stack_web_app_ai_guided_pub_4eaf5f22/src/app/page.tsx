import React from 'react';
import Link from 'next/link';
import SourceFooter from '@/components/SourceFooter';

type ProcedureCardDef = {
  href: string;
  title: string;
  description: string;
  cta: string;
  color: 'blue' | 'indigo' | 'emerald' | 'slate';
  iconPath: string;
};

const CARD_COLORS: Record<ProcedureCardDef['color'], { border: string; iconBg: string; icon: string; title: string; cta: string }> = {
  blue: { border: 'hover:border-blue-300', iconBg: 'from-blue-100 to-blue-200', icon: 'text-blue-600', title: 'group-hover:text-blue-600', cta: 'text-blue-600 group-hover:text-blue-700' },
  indigo: { border: 'hover:border-indigo-300', iconBg: 'from-indigo-100 to-indigo-200', icon: 'text-indigo-600', title: 'group-hover:text-indigo-600', cta: 'text-indigo-600 group-hover:text-indigo-700' },
  emerald: { border: 'hover:border-emerald-300', iconBg: 'from-emerald-100 to-emerald-200', icon: 'text-emerald-600', title: 'group-hover:text-emerald-600', cta: 'text-emerald-600 group-hover:text-emerald-700' },
  slate: { border: 'hover:border-slate-300', iconBg: 'from-slate-100 to-slate-200', icon: 'text-slate-600', title: 'group-hover:text-slate-700', cta: 'text-slate-600 group-hover:text-slate-700' },
};

const CITIZEN_CARDS: ProcedureCardDef[] = [
  {
    href: '/chat?procedure=MARRIAGE_REGISTRATION',
    title: 'Đăng ký kết hôn',
    description: 'Hướng dẫn chi tiết thủ tục đăng ký kết hôn trong nước, bao gồm chuẩn bị giấy tờ, điền tờ khai và nộp hồ sơ.',
    cta: 'Bắt đầu ngay',
    color: 'blue',
    iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    href: '/chat?procedure=BIRTH_REGISTRATION',
    title: 'Đăng ký khai sinh',
    description: 'Tìm hiểu các bước đăng ký khai sinh cho trẻ mới sinh, các giấy tờ cần chuẩn bị từ bệnh viện và gia đình.',
    cta: 'Bắt đầu ngay',
    color: 'indigo',
    iconPath: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

const BUSINESS_CARDS: ProcedureCardDef[] = [
  {
    href: '/chat?procedure=HOUSEHOLD_BUSINESS_REGISTRATION',
    title: 'Đăng ký hộ kinh doanh',
    description: 'Thành lập hộ kinh doanh theo Nghị định 168/2025/NĐ-CP: chỉ cần một bộ hồ sơ gọn nhẹ, nộp tại cấp xã, nhận kết quả trong 3 ngày làm việc.',
    cta: 'Bắt đầu ngay',
    color: 'emerald',
    iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    href: '/chat',
    title: 'Thủ tục khác cho doanh nghiệp',
    description: 'Chưa thấy thủ tục bạn cần? Hỏi trực tiếp trợ lý — hệ thống sẽ hướng dẫn hoặc chỉ ra danh mục thủ tục đang hỗ trợ.',
    cta: 'Hỏi trợ lý',
    color: 'slate',
    iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

function ProcedureCard({ card }: { card: ProcedureCardDef }) {
  const c = CARD_COLORS[card.color];
  return (
    <Link
      href={card.href}
      className={`group flex flex-col justify-between p-8 bg-white rounded-2xl shadow-lg border-2 border-slate-100 ${c.border} hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1`}
    >
      <div className="space-y-4">
        <div className={`w-14 h-14 bg-gradient-to-br ${c.iconBg} ${c.icon} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.iconPath} />
          </svg>
        </div>
        <h3 className={`text-2xl font-bold text-slate-900 ${c.title} transition-colors`}>
          {card.title}
        </h3>
        <p className="text-base text-slate-600 leading-relaxed">{card.description}</p>
      </div>
      <div className={`mt-6 flex items-center text-base font-semibold ${c.cta} group-hover:gap-2 transition-all`}>
        {card.cta}
        <svg
          className="w-5 h-5 ml-1 transform group-hover:translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-12 my-auto">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
            Phiên bản Beta - Miễn phí hoàn toàn
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 leading-tight">
            Trợ lý AI hướng dẫn<br />thủ tục hành chính
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Hỗ trợ giải đáp thắc mắc, chuẩn bị hồ sơ và hướng dẫn chi tiết các thủ tục hành chính công trực tuyến một cách dễ dàng và chính xác.
          </p>
          
          {/* Value Props */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4">
            <div className="flex items-center gap-3 text-left">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Nhanh chóng</p>
                <p className="text-sm text-slate-500">Chỉ 5-10 phút</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Chính xác</p>
                <p className="text-sm text-slate-500">Theo quy định mới nhất</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Dễ hiểu</p>
                <p className="text-sm text-slate-500">Hướng dẫn từng bước</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Form */}
        <form method="GET" action="/chat" className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-2 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <input
              type="text"
              name="q"
              placeholder="Ví dụ: Tôi muốn đăng ký kết hôn"
              className="w-full pl-4 pr-12 py-4 bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 text-base md:text-lg min-h-[56px]"
              required
            />
            <button
              type="submit"
              className="absolute right-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl p-4 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all min-h-[56px] flex items-center justify-center shadow-lg"
              aria-label="Tìm kiếm"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
          <p className="text-center text-sm text-slate-500 mt-3">
            💡 Bạn có thể mô tả bằng lời hoặc hỏi trực tiếp về thủ tục cần làm
          </p>
        </form>

        {/* How it works section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">Quy trình 3 bước đơn giản</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Mô tả nhu cầu</h3>
              <p className="text-sm text-slate-600">Nói cho AI biết bạn cần làm thủ tục gì</p>
            </div>
            <div className="relative text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Trả lời câu hỏi</h3>
              <p className="text-sm text-slate-600">AI sẽ hỏi thêm để hiểu rõ tình huống của bạn</p>
            </div>
            <div className="relative text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Nhận hướng dẫn</h3>
              <p className="text-sm text-slate-600">Xem danh sách giấy tờ và điền biểu mẫu</p>
            </div>
          </div>
        </div>

        {/* Procedures grouped by audience */}
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-2xl font-bold text-center text-slate-900">Thủ tục phổ biến</h2>

          <section aria-labelledby="citizen-procedures">
            <div className="flex justify-center mb-6">
              <span
                id="citizen-procedures"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold uppercase tracking-wide"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Dành cho Công dân
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CITIZEN_CARDS.map((card) => (
                <ProcedureCard key={card.href} card={card} />
              ))}
            </div>
          </section>

          <section aria-labelledby="business-procedures">
            <div className="flex justify-center mb-6">
              <span
                id="business-procedures"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold uppercase tracking-wide"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Dành cho Doanh nghiệp
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {BUSINESS_CARDS.map((card) => (
                <ProcedureCard key={card.href} card={card} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 w-full max-w-3xl mx-auto space-y-6 text-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
          <Link href="/sources" className="hover:text-blue-600 transition-colors min-h-[44px] flex items-center">
            Nguồn dữ liệu & Phiên bản
          </Link>
          <span className="text-slate-300 self-center">|</span>
          <Link href="/widget-demo" className="hover:text-blue-600 transition-colors min-h-[44px] flex items-center">
            Bản thử nghiệm Widget
          </Link>
          <span className="text-slate-300 self-center">|</span>
          <Link href="/admin" className="hover:text-blue-600 transition-colors min-h-[44px] flex items-center">
            Trang quản trị
          </Link>
        </div>
        <div className="border-t border-slate-200 pt-6">
          <SourceFooter showDisclaimer />
        </div>
      </footer>
    </div>
  );
}