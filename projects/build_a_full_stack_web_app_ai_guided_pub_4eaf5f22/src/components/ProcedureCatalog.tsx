'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type ProcedureCatalogItem = {
  code: string;
  name: string;
  sector: string;
  agency: string;
  audience: 'CITIZEN' | 'BUSINESS';
};

type AudienceFilter = 'ALL' | ProcedureCatalogItem['audience'];

type Props = {
  procedures: ProcedureCatalogItem[];
};

const FILTERS: { value: AudienceFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'CITIZEN', label: 'Công dân' },
  { value: 'BUSINESS', label: 'Doanh nghiệp' },
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

export default function ProcedureCatalog({ procedures }: Props) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<AudienceFilter>('ALL');

  const filteredProcedures = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return procedures.filter((procedure) => {
      if (audience !== 'ALL' && procedure.audience !== audience) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalizeText(
        `${procedure.name} ${procedure.sector} ${procedure.agency} ${procedure.code}`
      ).includes(normalizedQuery);
    });
  }, [audience, procedures, query]);

  return (
    <main className="catalog-page">
      <section className="catalog-hero" aria-labelledby="catalog-title">
        <div className="catalog-shell">
          <Link href="/user" className="catalog-back-link">
            <span aria-hidden="true">←</span>
            Trang chủ
          </Link>

          <div className="catalog-heading">
            <div>
              <p className="catalog-eyebrow">Danh mục dịch vụ</p>
              <h1 id="catalog-title">Tất cả thủ tục</h1>
              <p>
                Tìm đúng thủ tục bạn cần, sau đó mở trợ lý để được hướng dẫn từng bước.
              </p>
            </div>
            <span className="catalog-total">
              <strong>{procedures.length}</strong>
              thủ tục đang hỗ trợ
            </span>
          </div>

          <div className="catalog-toolbar">
            <label className="catalog-search">
              <span className="sr-only">Tìm kiếm thủ tục</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên thủ tục, lĩnh vực hoặc cơ quan..."
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="Xóa nội dung tìm kiếm">
                  ×
                </button>
              ) : null}
            </label>

            <div className="catalog-filters" aria-label="Lọc theo đối tượng">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={audience === filter.value}
                  onClick={() => setAudience(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="catalog-results" aria-live="polite">
        <div className="catalog-shell">
          <div className="catalog-results__header">
            <h2>Kết quả phù hợp</h2>
            <span>{filteredProcedures.length} thủ tục</span>
          </div>

          {filteredProcedures.length ? (
            <div className="catalog-grid">
              {filteredProcedures.map((procedure) => (
                <Link
                  key={procedure.code}
                  href={`/user/chat?procedure=${encodeURIComponent(procedure.code)}`}
                  className="catalog-card"
                >
                  <div className="catalog-card__top">
                    <span
                      className={`catalog-card__icon ${
                        procedure.audience === 'BUSINESS'
                          ? 'catalog-card__icon--business'
                          : 'catalog-card__icon--citizen'
                      }`}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
                        <path d="M14 3.5V8h4M9 12h6M9 15.5h6" />
                      </svg>
                    </span>
                    <span className="catalog-card__audience">
                      {procedure.audience === 'BUSINESS' ? 'Doanh nghiệp' : 'Công dân'}
                    </span>
                    <span className="catalog-card__arrow" aria-hidden="true">→</span>
                  </div>

                  <h3>{procedure.name}</h3>
                  <p className="catalog-card__sector">{procedure.sector}</p>
                  <p className="catalog-card__agency">{procedure.agency}</p>
                  <span className="catalog-card__cta">Nhận hướng dẫn</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <span aria-hidden="true">⌕</span>
              <h3>Chưa tìm thấy thủ tục phù hợp</h3>
              <p>Thử dùng từ khóa ngắn hơn hoặc chọn lại nhóm đối tượng.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setAudience('ALL');
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
