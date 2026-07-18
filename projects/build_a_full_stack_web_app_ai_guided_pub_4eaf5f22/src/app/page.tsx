import React from 'react';
import Link from 'next/link';
import SourceFooter from '@/components/SourceFooter';

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

        {/* Popular procedures cards */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-6">Thủ tục phổ biến</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/chat?procedure=MARRIAGE_REGISTRATION"
              className="group flex flex-col justify-between p-8 bg-white rounded-2xl shadow-lg border-2 border-slate-100 hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Đăng ký kết hôn
                </h3>
                <p className="text-base text-slate-600 leading-relaxed">
                  Hướng dẫn chi tiết thủ tục đăng ký kết hôn trong nước, bao gồm chuẩn bị giấy tờ, điền tờ khai và nộp hồ sơ.
                </p>
              </div>
              <div className="mt-6 flex items-center text-base font-semibold text-blue-600 group-hover:text-blue-700 group-hover:gap-2 transition-all">
                Bắt đầu ngay
                <svg
                  className="w-5 h-5 ml-1 transform group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>

            <Link
              href="/chat?procedure=BIRTH_REGISTRATION"
              className="group flex flex-col justify-between p-8 bg-white rounded-2xl shadow-lg border-2 border-slate-100 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Đăng ký khai sinh
                </h3>
                <p className="text-base text-slate-600 leading-relaxed">
                  Tìm hiểu các bước đăng ký khai sinh cho trẻ mới sinh, các giấy tờ cần chuẩn bị từ bệnh viện và gia đình.
                </p>
              </div>
              <div className="mt-6 flex items-center text-base font-semibold text-indigo-600 group-hover:text-indigo-700 group-hover:gap-2 transition-all">
                Bắt đầu ngay
                <svg
                  className="w-5 h-5 ml-1 transform group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          </div>
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