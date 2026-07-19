import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import SourceFooter from '@/components/SourceFooter';

const benefits = [
  {
    title: 'Nhanh chóng',
    description: 'Chỉ 5–10 phút',
    tone: 'green',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 4.2 4.2L19 7" />
      </svg>
    ),
  },
  {
    title: 'Chính xác',
    description: 'Theo quy định mới nhất',
    tone: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    title: 'Dễ hiểu',
    description: 'Hướng dẫn từng bước',
    tone: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.8c2.7-.9 5.3-.2 8 1.5v11c-2.7-1.7-5.3-2.4-8-1.5v-11Zm16 0c-2.7-.9-5.3-.2-8 1.5v11c2.7-1.7 5.3-2.4 8-1.5v-11Z" />
      </svg>
    ),
  },
];

const steps = [
  { number: '1', title: 'Nhập câu hỏi', description: 'Mô tả thủ tục bạn cần', tone: 'blue' },
  { number: '2', title: 'AI phân tích', description: 'Tìm thông tin chính xác', tone: 'indigo' },
  { number: '3', title: 'Nhận hướng dẫn', description: 'Xem chi tiết từng bước', tone: 'purple' },
];

type ProcedureCardDef = {
  href: string;
  title: string;
  description: string;
  tone: 'blue' | 'purple' | 'orange' | 'cyan';
  cta?: string;
  icon: ReactNode;
};

const CITIZEN_CARDS: ProcedureCardDef[] = [
  {
    href: '/user/chat?procedure=MARRIAGE_REGISTRATION',
    title: 'Đăng ký kết hôn',
    description: 'Chuẩn bị giấy tờ, điền tờ khai và nộp hồ sơ đăng ký kết hôn trong nước.',
    tone: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.3 6.3a4.5 4.5 0 0 0 0 6.4L12 20.4l7.7-7.7a4.5 4.5 0 0 0-6.4-6.4L12 7.6l-1.3-1.3a4.5 4.5 0 0 0-6.4 0Z" />
      </svg>
    ),
  },
  {
    href: '/user/chat?procedure=BIRTH_REGISTRATION',
    title: 'Đăng ký khai sinh',
    description: 'Tìm hiểu các bước và giấy tờ cần chuẩn bị để đăng ký khai sinh cho trẻ.',
    tone: 'purple',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M7.5 12h9" />
      </svg>
    ),
  },
  {
    href: '/user/chat?procedure=TEMP_RESIDENCE_REGISTRATION',
    title: 'Đăng ký tạm trú',
    description: 'Khai báo tạm trú theo mẫu CT01: chuẩn bị giấy tờ và nộp hồ sơ tại công an cấp xã.',
    tone: 'orange',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3.5 10 8.5-7 8.5 7" />
        <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
      </svg>
    ),
  },
  {
    href: '/user/chat?q=cấp%20lại%20CCCD',
    title: 'Cấp lại CCCD',
    description: 'Hướng dẫn cấp lại Căn cước công dân khi bị mất hoặc hư hỏng.',
    tone: 'cyan',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2.2" />
        <path d="M5.8 16c.7-1.7 1.8-2.5 3.2-2.5s2.5.8 3.2 2.5M15 10h3.5M15 14h3.5" />
      </svg>
    ),
  },
];

const BUSINESS_CARDS: ProcedureCardDef[] = [
  {
    href: '/user/chat?procedure=HOUSEHOLD_BUSINESS_REGISTRATION',
    title: 'Đăng ký hộ kinh doanh',
    description:
      'Thành lập hộ kinh doanh theo Nghị định 168/2025/NĐ-CP: một bộ hồ sơ gọn nhẹ, nộp tại cấp xã, kết quả trong 3 ngày làm việc.',
    tone: 'blue',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M5 20h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
        <path d="M12 11v3" />
      </svg>
    ),
  },
  {
    href: '/user/chat',
    title: 'Thủ tục khác cho doanh nghiệp',
    description:
      'Chưa thấy thủ tục bạn cần? Hỏi trực tiếp trợ lý — hệ thống sẽ hướng dẫn hoặc chỉ ra danh mục đang hỗ trợ.',
    tone: 'purple',
    cta: 'Hỏi trợ lý',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.2 9c.5-1.2 2-2 3.8-2 2.2 0 4 1.3 4 3 0 1.4-1.3 2.6-3 2.9-.5.1-1 .5-1 1.1m0 3h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
];

function ProcedureCard({ card }: { card: ProcedureCardDef }) {
  return (
    <Link href={card.href} className="procedure-card">
      <div className={`procedure-card__icon procedure-card__icon--${card.tone}`}>{card.icon}</div>
      <div className="procedure-card__body">
        <div className="procedure-card__heading">
          <h4>{card.title}</h4>
          <span className="procedure-card__arrow" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M4 10h11m-4-4 4 4-4 4" />
            </svg>
          </span>
        </div>
        <p>{card.description}</p>
        <span className="procedure-card__link">{card.cta ?? 'Xem hướng dẫn'}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__veil" aria-hidden="true" />

        <div className="scene-life" aria-hidden="true">
          <svg className="scene-birds scene-birds--left" viewBox="0 0 140 64">
            <g className="scene-bird scene-bird--one">
              <path d="M5 25c9-10 18-10 27 0 9-10 18-10 27 0" />
            </g>
            <g className="scene-bird scene-bird--two">
              <path d="M78 12c7-8 14-8 21 0 7-8 14-8 21 0" />
            </g>
            <g className="scene-bird scene-bird--three">
              <path d="M90 48c6-7 12-7 18 0 6-7 12-7 18 0" />
            </g>
          </svg>

          <svg className="scene-birds scene-birds--right" viewBox="0 0 105 52">
            <g className="scene-bird scene-bird--one">
              <path d="M4 22c8-9 16-9 24 0 8-9 16-9 24 0" />
            </g>
            <g className="scene-bird scene-bird--two">
              <path d="M58 38c6-7 12-7 18 0 6-7 12-7 18 0" />
            </g>
          </svg>

          <svg className="scene-dragonfly scene-dragonfly--left" viewBox="0 0 66 48">
            <g className="dragonfly-wings">
              <ellipse cx="25" cy="16" rx="15" ry="7" transform="rotate(-25 25 16)" />
              <ellipse cx="41" cy="16" rx="15" ry="7" transform="rotate(25 41 16)" />
              <ellipse cx="25" cy="31" rx="13" ry="6" transform="rotate(24 25 31)" />
              <ellipse cx="41" cy="31" rx="13" ry="6" transform="rotate(-24 41 31)" />
            </g>
            <path className="dragonfly-body" d="M33 8v31m0-31-4-5m4 5 4-5" />
          </svg>

          <svg className="scene-dragonfly scene-dragonfly--right" viewBox="0 0 66 48">
            <g className="dragonfly-wings">
              <ellipse cx="25" cy="16" rx="15" ry="7" transform="rotate(-25 25 16)" />
              <ellipse cx="41" cy="16" rx="15" ry="7" transform="rotate(25 41 16)" />
              <ellipse cx="25" cy="31" rx="13" ry="6" transform="rotate(24 25 31)" />
              <ellipse cx="41" cy="31" rx="13" ry="6" transform="rotate(-24 41 31)" />
            </g>
            <path className="dragonfly-body" d="M33 8v31m0-31-4-5m4 5 4-5" />
          </svg>

          <svg className="scene-cloud scene-cloud--left" viewBox="0 0 190 72">
            <path d="M8 52c16 0 21-12 20-21 16 5 21-9 21-17 18 2 25 13 23 24 15-4 25 4 25 14h85" />
          </svg>

          <div className="scene-petals scene-petals--one"><span /></div>
          <div className="scene-petals scene-petals--two"><span /></div>
          <div className="scene-petals scene-petals--three"><span /></div>

          <div className="scene-ripple scene-ripple--one"><span /><span /></div>
          <div className="scene-ripple scene-ripple--two"><span /><span /></div>
          <div className="scene-water-shimmer" />
        </div>

        <div className="home-hero__content">
          <h1 id="home-title" className="home-title">
            Trợ lý AI hướng dẫn
            <span>thủ tục hành chính</span>
          </h1>

          <p className="home-subtitle">
            Hỗ trợ giải đáp thắc mắc, chuẩn bị hồ sơ và hướng dẫn chi tiết các thủ tục
            hành chính công trực tuyến một cách dễ dàng và chính xác.
          </p>

          <div className="benefit-row" aria-label="Lợi ích">
            {benefits.map((benefit) => (
              <div className="benefit" key={benefit.title}>
                <div className={`benefit__icon benefit__icon--${benefit.tone}`}>{benefit.icon}</div>
                <div>
                  <strong>{benefit.title}</strong>
                  <span>{benefit.description}</span>
                </div>
              </div>
            ))}
          </div>

          <form method="GET" action="/user/chat" className="hero-search">
            <label className="sr-only" htmlFor="procedure-search">
              Mô tả thủ tục bạn muốn thực hiện
            </label>
            <input
              id="procedure-search"
              type="text"
              name="q"
              placeholder="Ví dụ: Tôi muốn đăng ký kết hôn"
              autoComplete="off"
              required
            />
            <button type="submit" aria-label="Tìm kiếm">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
            </button>
          </form>

          <p className="search-hint">
            <span aria-hidden="true">💡</span>
            Bạn có thể mô tả bằng lời hoặc hỏi trực tiếp về thủ tục cần làm
          </p>
        </div>

        <div className="process-wrap">
          <h2>Quy trình 3 bước đơn giản</h2>
          <div className="process-bar">
            {steps.map((step, index) => (
              <Fragment key={step.number}>
                <div className="process-segment">
                  <div className={`step-number step-number--${step.tone}`}>{step.number}</div>
                  <div className="step-copy">
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <svg className="step-arrow" viewBox="0 0 42 18" aria-hidden="true">
                    <path d="M1 9h34m-6-6 6 6-6 6" />
                  </svg>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="popular-section" aria-labelledby="popular-title">
        <div className="popular-section__inner">
          <header className="popular-heading">
            <div>
              <p className="section-eyebrow">Bắt đầu nhanh</p>
              <h2 id="popular-title">Thủ tục phổ biến</h2>
              <p className="section-lead">Chọn nhu cầu phù hợp để nhận hướng dẫn từng bước.</p>
            </div>
            <Link href="/user/procedures" className="all-procedures-link">
              Xem tất cả thủ tục
              <span aria-hidden="true">→</span>
            </Link>
          </header>

          <div className="procedure-groups">
            <section className="procedure-group procedure-group--citizen" aria-labelledby="citizen-procedures">
              <header className="procedure-group__header">
                <div className="procedure-group__identity">
                  <span className="procedure-group__mark procedure-group__mark--citizen" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5.5 20c.6-4.3 2.8-6.5 6.5-6.5s5.9 2.2 6.5 6.5" />
                    </svg>
                  </span>
                  <div>
                    <p>Dành cho cá nhân</p>
                    <h3 id="citizen-procedures">Thủ tục công dân</h3>
                  </div>
                </div>
                <span className="procedure-group__count">{CITIZEN_CARDS.length} lựa chọn</span>
              </header>
              <div className="procedure-grid procedure-grid--citizen">
                {CITIZEN_CARDS.map((card) => (
                  <ProcedureCard key={card.href} card={card} />
                ))}
              </div>
            </section>

            <section className="procedure-group procedure-group--business" aria-labelledby="business-procedures">
              <header className="procedure-group__header">
                <div className="procedure-group__identity">
                  <span className="procedure-group__mark procedure-group__mark--business" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
                      <rect x="3" y="7" width="18" height="13" rx="2.5" />
                      <path d="M3 12h18M10 12v2h4v-2" />
                    </svg>
                  </span>
                  <div>
                    <p>Dành cho tổ chức</p>
                    <h3 id="business-procedures">Thủ tục doanh nghiệp</h3>
                  </div>
                </div>
                <span className="procedure-group__count">{BUSINESS_CARDS.length} lựa chọn</span>
              </header>
              <div className="procedure-grid procedure-grid--business">
                {BUSINESS_CARDS.map((card) => (
                  <ProcedureCard key={card.href} card={card} />
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer className="home-footer">
          <nav aria-label="Liên kết bổ sung">
            <Link href="/sources">Nguồn dữ liệu &amp; Phiên bản</Link>
            <span aria-hidden="true">•</span>
            <a href="https://dichvucong.gov.vn">Cổng Dịch vụ công Quốc gia</a>
          </nav>
          <SourceFooter showDisclaimer />
        </footer>
      </section>
    </main>
  );
}
