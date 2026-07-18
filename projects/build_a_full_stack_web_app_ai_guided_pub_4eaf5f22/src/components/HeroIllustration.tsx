import { useId } from 'react';

/**
 * Hero pure SVG + mesh Tailwind — “Thủ tục nhanh & thông minh”.
 */
export default function HeroIllustration({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gCard = `hi-card-${uid}`;
  const gBrand = `hi-brand-${uid}`;
  const gAccent = `hi-accent-${uid}`;
  const fSoft = `hi-soft-${uid}`;

  return (
    <div
      className={`relative mx-auto w-full max-w-lg ${className}`}
      role="img"
      aria-label="Minh họa: hồ sơ hành chính được AI hỗ trợ nhanh chóng"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[6%] top-[10%] h-40 w-40 rounded-full bg-brand-400/45 blur-3xl" />
        <div className="absolute bottom-[8%] right-[4%] h-44 w-44 rounded-full bg-accent-400/40 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-sky-300/35 blur-2xl" />
      </div>

      <svg
        viewBox="0 0 480 320"
        className="relative z-[1] h-auto w-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gCard} x1="80" y1="40" x2="280" y2="280" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id={gBrand} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#1e3a5f" />
          </linearGradient>
          <linearGradient id={gAccent} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fbbf24" />
            <stop offset="1" stopColor="#d97706" />
          </linearGradient>
          <filter id={fSoft} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#1e3a5f" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* Khung nền dashed — cảm giác “cổng dịch vụ số” */}
        <rect x="20" y="24" width="440" height="272" rx="28" fill="#eff6ff" fillOpacity="0.6" />
        <rect
          x="20"
          y="24"
          width="440"
          height="272"
          rx="28"
          stroke="#93c5fd"
          strokeWidth="1.5"
          strokeDasharray="5 7"
          opacity="0.75"
        />

        {/* Thẻ hồ sơ chính */}
        <g filter={`url(#${fSoft})`}>
          <rect x="68" y="60" width="204" height="196" rx="16" fill={`url(#${gCard})`} stroke="#e2e8f0" strokeWidth="1.5" />
          <rect x="68" y="60" width="204" height="40" rx="16" fill={`url(#${gBrand})`} />
          <rect x="68" y="84" width="204" height="16" fill={`url(#${gBrand})`} />
          {/* Dấu mộc vàng */}
          <circle cx="92" cy="80" r="7" fill="#f59e0b" stroke="white" strokeWidth="1.2" />
          <path d="M92 76.5v7M88.5 80h7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="108" y="74" width="78" height="6" rx="3" fill="white" fillOpacity="0.92" />
          <rect x="108" y="84" width="52" height="4" rx="2" fill="white" fillOpacity="0.5" />
          {/* Dòng form */}
          <rect x="88" y="120" width="164" height="10" rx="5" fill="#dbeafe" />
          <rect x="88" y="142" width="124" height="10" rx="5" fill="#e2e8f0" />
          <rect x="88" y="164" width="152" height="10" rx="5" fill="#e2e8f0" />
          <rect x="88" y="186" width="104" height="10" rx="5" fill="#dbeafe" />
          <rect x="88" y="216" width="18" height="18" rx="4" fill="#2563eb" />
          <path d="M92.5 225l3.2 3.2 6.8-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="114" y="220" width="96" height="8" rx="4" fill="#cbd5e1" />
        </g>

        {/* Thẻ phụ tốc độ */}
        <g opacity="0.95" filter={`url(#${fSoft})`}>
          <rect x="248" y="96" width="152" height="124" rx="14" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
          <rect x="264" y="116" width="92" height="8" rx="4" fill="#bfdbfe" />
          <rect x="264" y="136" width="116" height="6" rx="3" fill="#e2e8f0" />
          <rect x="264" y="152" width="100" height="6" rx="3" fill="#e2e8f0" />
          <rect x="264" y="176" width="72" height="24" rx="10" fill={`url(#${gAccent})`} />
          <text x="278" y="192" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
            Nhanh
          </text>
        </g>

        {/* Orb AI */}
        <g filter={`url(#${fSoft})`}>
          <circle cx="368" cy="86" r="36" fill={`url(#${gBrand})`} />
          <circle cx="368" cy="86" r="36" stroke="white" strokeWidth="2" strokeOpacity="0.35" />
          <circle cx="356" cy="78" r="3.5" fill="#93c5fd" />
          <circle cx="380" cy="78" r="3.5" fill="#93c5fd" />
          <circle cx="368" cy="98" r="3.5" fill="#fbbf24" />
          <path d="M356 78l12 20M380 78l-12 20M356 78h24" stroke="#bfdbfe" strokeWidth="1.5" />
          <path
            d="M368 68v-7M368 111v-7M346 86h-7M397 86h-7"
            stroke="#fbbf24"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </g>

        {/* Đường dẫn tốc độ */}
        <path
          d="M286 232c30-20 52-14 78 6"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="4 6"
          opacity="0.55"
        />
        <path d="M352 244l14 2-7 11" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />

        {/* Badge */}
        <rect x="292" y="252" width="128" height="30" rx="15" fill="white" stroke="#93c5fd" strokeWidth="1.5" />
        <circle cx="312" cy="267" r="8" fill="#2563eb" />
        <path d="M312 262.5v9M307.5 267h9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <text x="328" y="271" fill="#1e3a5f" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
          AI · Thủ tục
        </text>
      </svg>
    </div>
  );
}
