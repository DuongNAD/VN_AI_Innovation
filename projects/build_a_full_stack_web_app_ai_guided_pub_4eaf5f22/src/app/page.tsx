import React from 'react';
import Link from 'next/link';
import SourceFooter from '@/components/SourceFooter';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full space-y-12 my-auto">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            Trợ lý AI hướng dẫn thủ tục hành chính
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Hỗ trợ giải đáp thắc mắc, chuẩn bị hồ sơ và hướng dẫn chi tiết các thủ tục hành chính công trực tuyến một cách dễ dàng và chính xác.
          </p>
        </div>

        {/* Search Form */}
        <form method="GET" action="/chat" className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-white rounded-2xl shadow-sm border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
            <input
              type="text"
              name="q"
              placeholder="Ví dụ: Tôi muốn đăng ký kết hôn"
              className="w-full pl-4 pr-12 py-3 bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 text-base md:text-lg min-h-[44px]"
              required
            />
            <button
              type="submit"
              className="absolute right-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-h-[44px] flex items-center justify-center"
              aria-label="Tìm kiếm"
            >
              <svg
                className="w-5 h-5"
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
        </form>

        {/* Two Large Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link
            href="/chat?procedure=MARRIAGE_REGISTRATION"
            className="group flex flex-col justify-between p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
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
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Đăng ký kết hôn
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Hướng dẫn chi tiết thủ tục đăng ký kết hôn trong nước, bao gồm chuẩn bị giấy tờ, điền tờ khai và nộp hồ sơ.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-blue-600 group-hover:text-blue-700">
              Bắt đầu ngay
              <svg
                className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
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
            className="group flex flex-col justify-between p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
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
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Đăng ký khai sinh
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Tìm hiểu các bước đăng ký khai sinh cho trẻ mới sinh, các giấy tờ cần chuẩn bị từ bệnh viện và gia đình.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">
              Bắt đầu ngay
              <svg
                className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform"
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