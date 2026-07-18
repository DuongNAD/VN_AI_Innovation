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
          <div className="beta-badge">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 2.2a5.2 5.2 0 0 0-5.2 5.2v3.1l-1.2 1.2c-.6.6-.2 1.6.7 1.6h11.4c.9 0 1.3-1 .7-1.6l-1.2-1.2V7.4A5.2 5.2 0 0 0 10 2.2Zm0 15.6a2.7 2.7 0 0 0 2.6-2H7.4a2.7 2.7 0 0 0 2.6 2Z" />
            </svg>
            Phiên bản Beta – Miễn phí hoàn toàn
          </div>

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

          <form method="GET" action="/chat" className="hero-search">
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
              <div className="process-segment" key={step.number}>
                <div className={`step-number step-number--${step.tone}`}>{step.number}</div>
                <div className="step-copy">
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </div>
                {index < steps.length - 1 && (
                  <svg className="step-arrow" viewBox="0 0 42 18" aria-hidden="true">
                    <path d="M1 9h34m-6-6 6 6-6 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="popular-section" aria-labelledby="popular-title">
        <div className="popular-section__inner">
          <p className="section-eyebrow">Bắt đầu nhanh</p>
          <h2 id="popular-title">Thủ tục phổ biến</h2>
          <p className="section-lead">Chọn một thủ tục thường gặp để nhận hướng dẫn ngay.</p>

          <div className="procedure-grid">
            <Link href="/chat?procedure=MARRIAGE_REGISTRATION" className="procedure-card">
              <div className="procedure-card__icon procedure-card__icon--blue">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4.3 6.3a4.5 4.5 0 0 0 0 6.4L12 20.4l7.7-7.7a4.5 4.5 0 0 0-6.4-6.4L12 7.6l-1.3-1.3a4.5 4.5 0 0 0-6.4 0Z" />
                </svg>
              </div>
              <div>
                <h3>Đăng ký kết hôn</h3>
                <p>Chuẩn bị giấy tờ, điền tờ khai và nộp hồ sơ đăng ký kết hôn trong nước.</p>
                <span className="procedure-card__link">Bắt đầu ngay →</span>
              </div>
            </Link>

            <Link href="/chat?procedure=BIRTH_REGISTRATION" className="procedure-card">
              <div className="procedure-card__icon procedure-card__icon--purple">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5v9M7.5 12h9" />
                </svg>
              </div>
              <div>
                <h3>Đăng ký khai sinh</h3>
                <p>Tìm hiểu các bước và giấy tờ cần chuẩn bị để đăng ký khai sinh cho trẻ.</p>
                <span className="procedure-card__link">Bắt đầu ngay →</span>
              </div>
            </Link>

            <Link href="/chat?q=đăng%20ký%20thường%20trú" className="procedure-card">
              <div className="procedure-card__icon procedure-card__icon--orange">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3.5 10 8.5-7 8.5 7" />
                  <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
                </svg>
              </div>
              <div>
                <h3>Đăng ký thường trú</h3>
                <p>Hướng dẫn thủ tục đăng ký thường trú cho cá nhân và hộ gia đình.</p>
                <span className="procedure-card__link">Bắt đầu ngay →</span>
              </div>
            </Link>

            <Link href="/chat?q=cấp%20lại%20CCCD" className="procedure-card">
              <div className="procedure-card__icon procedure-card__icon--cyan">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2.2" />
                  <path d="M5.8 16c.7-1.7 1.8-2.5 3.2-2.5s2.5.8 3.2 2.5M15 10h3.5M15 14h3.5" />
                </svg>
              </div>
              <div>
                <h3>Cấp lại CCCD</h3>
                <p>Hướng dẫn cấp lại Căn cước công dân khi bị mất hoặc hư hỏng.</p>
                <span className="procedure-card__link">Bắt đầu ngay →</span>
              </div>
            </Link>
          </div>

          <Link href="/chat" className="all-procedures-link">
            Xem tất cả thủ tục
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <footer className="home-footer">
          <nav aria-label="Liên kết bổ sung">
            <Link href="/sources">Nguồn dữ liệu &amp; Phiên bản</Link>
            <span aria-hidden="true">•</span>
            <Link href="/widget-demo">Bản thử nghiệm Widget</Link>
            <span aria-hidden="true">•</span>
            <Link href="/admin">Trang quản trị</Link>
          </nav>
          <SourceFooter showDisclaimer />
        </footer>
      </section>
    </main>
  );
}
