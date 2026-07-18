'use client';

import BrandLogo from '@/components/BrandLogo';

type ChatWelcomeProps = {
  busy: boolean;
  onStartMarriage: () => void;
  onStartBirth: () => void;
  onDescribeNeed: () => void;
};

/** Empty/welcome UI for ChatIntake — pure presentation + callbacks */
export default function ChatWelcome({
  busy,
  onStartMarriage,
  onStartBirth,
  onDescribeNeed,
}: ChatWelcomeProps) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 py-4 text-center">
      <BrandLogo size="lg" href={null} />
      <svg
        viewBox="0 0 200 120"
        className="h-28 w-full max-w-[220px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="20" y="24" width="100" height="72" rx="10" fill="white" stroke="#bfdbfe" strokeWidth="2" />
        <rect x="20" y="24" width="100" height="18" rx="10" fill="#2563eb" />
        <rect x="20" y="34" width="100" height="8" fill="#2563eb" />
        <rect x="34" y="54" width="72" height="6" rx="3" fill="#dbeafe" />
        <rect x="34" y="68" width="56" height="6" rx="3" fill="#e2e8f0" />
        <rect x="34" y="82" width="40" height="6" rx="3" fill="#e2e8f0" />
        <circle cx="150" cy="52" r="28" fill="#1d4ed8" />
        <circle cx="140" cy="48" r="3" fill="#93c5fd" />
        <circle cx="160" cy="48" r="3" fill="#93c5fd" />
        <circle cx="150" cy="62" r="3" fill="#fbbf24" />
        <path d="M140 48l10 14M160 48l-10 14M140 48h20" stroke="#bfdbfe" strokeWidth="1.5" />
        <rect x="128" y="88" width="52" height="18" rx="9" fill="#f59e0b" />
        <path d="M140 97h28" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="space-y-2">
        <h2 className="text-title text-brand-900 sm:text-xl">
          Chào mừng đến Trợ lý Thủ tục Hành chính
        </h2>
        <p className="text-body text-slate-600">
          VN AI Innovation — chọn lối tắt bên dưới hoặc gõ nhu cầu của bạn.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={busy}
          onClick={onStartMarriage}
          className="card-premium p-4 text-left hover:shadow-glow disabled:opacity-60"
        >
          <span className="block text-sm font-bold text-brand-800">Đăng ký kết hôn</span>
          <span className="mt-1 block text-xs text-slate-500">Bắt đầu ngay</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStartBirth}
          className="card-premium p-4 text-left hover:shadow-glow-accent disabled:opacity-60"
        >
          <span className="block text-sm font-bold text-accent-800">Đăng ký khai sinh</span>
          <span className="mt-1 block text-xs text-slate-500">Bắt đầu ngay</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDescribeNeed}
          className="card-premium p-4 text-left hover:border-brand-300 disabled:opacity-60"
        >
          <span className="block text-sm font-bold text-slate-800">Mô tả nhu cầu</span>
          <span className="mt-1 block text-xs text-slate-500">AI nhận diện thủ tục</span>
        </button>
      </div>
    </div>
  );
}
