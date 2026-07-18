import React from 'react';
import Link from 'next/link';
import SourceFooter from '@/components/SourceFooter';
import BrandLogo from '@/components/BrandLogo';
import HeroIllustration from '@/components/HeroIllustration';

const JOURNEY = [
  { n: 1, label: 'Tư vấn' },
  { n: 2, label: 'Giấy tờ' },
  { n: 3, label: 'Biểu mẫu' },
  { n: 4, label: 'Kiểm tra' },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col justify-between text-slate-900">
      {/* Thanh thương hiệu — không còn banner debug */}
      <div className="border-b border-white/50 bg-white/70 shadow-shell backdrop-blur-glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogo size="md" href="/user" />
          <Link
            href="/user/chat"
            className="btn-primary min-h-touch px-4 py-2 text-sm sm:px-5"
          >
            Bắt đầu tư vấn
          </Link>
        </div>
      </div>

      <div className="mx-auto my-auto w-full max-w-4xl space-y-12 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-14 lg:px-8">
        {/* Hero: copy + illustration */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-brand-300 bg-white px-4 py-2 text-overline uppercase text-brand-800 shadow-glow">
              VN AI Innovation
            </div>

            <h1 className="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 bg-clip-text text-display text-transparent drop-shadow-sm">
              Trợ lý Thủ tục
              <br />
              Hành chính
            </h1>

            <p className="mx-auto max-w-xl text-body-lg text-slate-600 lg:mx-0">
              Trợ lý AI hướng dẫn giấy tờ, điền biểu mẫu và kiểm tra hồ sơ trước khi nộp —
              nhanh, rõ ràng, theo lộ trình 4 bước.
            </p>

            {/* Journey strip */}
            <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-surface/90 p-4 shadow-shell-lg ring-1 ring-slate-900/5 backdrop-blur-sm lg:mx-0">
              <p className="mb-3 text-overline uppercase text-brand-700">Lộ trình hồ sơ</p>
              <ol className="flex items-center justify-between gap-1" aria-label="4 bước hỗ trợ">
                {JOURNEY.map((step, i) => (
                  <li key={step.n} className="flex flex-1 items-center">
                    <div className="flex min-w-0 flex-col items-center">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${
                          i === 0 ? 'bg-brand-600 ring-4 ring-brand-200' : 'bg-brand-500'
                        }`}
                      >
                        {step.n}
                      </span>
                      <span className="mt-1 truncate text-[10px] font-semibold tracking-snugish text-slate-700 sm:text-xs">
                        {step.label}
                      </span>
                    </div>
                    {i < JOURNEY.length - 1 && (
                      <div className="mx-0.5 mb-4 h-1 flex-1 rounded bg-brand-200" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <HeroIllustration className="max-w-md lg:max-w-none" />
        </div>

        {/* Search Form */}
        <form method="GET" action="/user/chat" className="mx-auto max-w-2xl">
          <div className="relative flex items-center rounded-2xl border-2 border-surface-border bg-surface/95 p-2 shadow-shell-lg ring-1 ring-slate-900/5 backdrop-blur-sm transition-all focus-within:border-brand-500 focus-within:shadow-glow focus-within:ring-4 focus-within:ring-brand-500/20">
            <input
              type="text"
              name="q"
              placeholder="Ví dụ: Tôi muốn đăng ký kết hôn"
              className="min-h-[56px] w-full border-none bg-transparent py-4 pl-4 pr-16 text-body-lg tracking-snugish text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0"
              required
            />
            <button
              type="submit"
              className="absolute right-3 flex min-h-[56px] items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 p-4 text-white shadow-lg transition-all hover:from-brand-700 hover:to-brand-800 hover:shadow-glow focus:outline-none focus:ring-4 focus:ring-brand-500/50"
              aria-label="Tìm kiếm"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-slate-600">
            Mô tả nhu cầu bằng lời — trợ lý AI sẽ nhận diện thủ tục phù hợp
          </p>
        </form>

        {/* Value Props */}
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: 'Nhanh chóng', sub: 'Chỉ 5–10 phút', tone: 'bg-emerald-100 text-emerald-600' },
            { title: 'Chính xác', sub: 'Theo quy định mới', tone: 'bg-brand-100 text-brand-600' },
            { title: 'Dễ hiểu', sub: 'Từng bước rõ ràng', tone: 'bg-accent-100 text-accent-700' },
          ].map((v) => (
            <div
              key={v.title}
              className="card-premium flex items-center gap-3 p-3 text-left"
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${v.tone.split(' ')[0]}`}
              >
                <span className={`text-sm font-bold ${v.tone.split(' ')[1]}`}>✓</span>
              </div>
              <div>
                <p className="font-semibold tracking-snugish text-slate-900">{v.title}</p>
                <p className="text-sm text-slate-500">{v.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Popular procedures */}
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-center text-title text-slate-900 sm:text-2xl sm:font-semibold">
            Thủ tục phổ biến
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Link
              href="/user/chat?procedure=MARRIAGE_REGISTRATION"
              className="card-premium group flex cursor-pointer flex-col justify-between p-8"
            >
              <div className="space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-600 motion-safe:transition-transform motion-safe:group-hover:scale-110">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold tracking-snugish text-slate-900 transition-colors group-hover:text-brand-600">
                  Đăng ký kết hôn
                </h3>
                <p className="text-body leading-relaxed text-slate-600">
                  Hướng dẫn chi tiết thủ tục đăng ký kết hôn trong nước, bao gồm chuẩn bị giấy tờ,
                  điền tờ khai và nộp hồ sơ.
                </p>
              </div>
              <div className="mt-6 flex items-center text-base font-semibold text-brand-600 transition-all group-hover:gap-2 group-hover:text-brand-700">
                Bắt đầu ngay
                <svg
                  className="ml-1 h-5 w-5 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link
              href="/user/chat?procedure=BIRTH_REGISTRATION"
              className="card-premium group flex cursor-pointer flex-col justify-between p-8 hover:shadow-glow-accent"
            >
              <div className="space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-accent-100 to-accent-200 text-accent-700 motion-safe:transition-transform motion-safe:group-hover:scale-110">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold tracking-snugish text-slate-900 transition-colors group-hover:text-accent-700">
                  Đăng ký khai sinh
                </h3>
                <p className="text-body leading-relaxed text-slate-600">
                  Tìm hiểu các bước đăng ký khai sinh cho trẻ mới sinh, các giấy tờ cần chuẩn bị từ
                  bệnh viện và gia đình.
                </p>
              </div>
              <div className="mt-6 flex items-center text-base font-semibold text-accent-700 transition-all group-hover:gap-2 group-hover:text-accent-900">
                Bắt đầu ngay
                <svg
                  className="ml-1 h-5 w-5 motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <footer className="mx-auto mt-16 w-full max-w-3xl space-y-6 px-4 text-center sm:mt-22 sm:px-6">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
          <Link href="/sources" className="flex min-h-[44px] items-center transition-colors hover:text-brand-600">
            Nguồn dữ liệu & Phiên bản
          </Link>
          <span className="self-center text-slate-300" aria-hidden="true">
            |
          </span>
          <a
            href="https://dichvucong.gov.vn/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] cursor-pointer items-center transition-colors hover:text-brand-600"
          >
            Bản thử nghiệm Widget
          </a>
        </div>
        <div className="border-t border-surface-border pt-6">
          <SourceFooter showDisclaimer />
        </div>
      </footer>
    </div>
  );
}
