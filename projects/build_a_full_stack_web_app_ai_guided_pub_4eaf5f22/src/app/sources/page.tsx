import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { selectActiveVersion } from '@/lib/form-migration';
import { safeHttpsUrl } from '@/lib/schema-guards';
import { DISCLAIMER } from '@/lib/constants';

// This page reflects live catalog data (procedures, versions, effective dates)
// and must never be statically prerendered at build time, when no database is
// reachable.
export const dynamic = 'force-dynamic';

function formatDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

type StatusKey = 'ACTIVE' | 'DRAFT' | 'RETIRED';

const STATUS_STYLES: Record<StatusKey, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  RETIRED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<StatusKey, string> = {
  ACTIVE: 'Đang hiệu lực',
  DRAFT: 'Bản nháp',
  RETIRED: 'Đã thay thế',
};

async function loadCatalog() {
  const procedures = await prisma.procedure.findMany({
    include: { versions: true, forms: { include: { versions: true } } },
    orderBy: { code: 'asc' },
  });

  return procedures.map((proc) => {
    const activeVersion = selectActiveVersion(proc.versions, new Date());
    const formVersions = proc.forms.flatMap((form) =>
      form.versions.map((fv) => ({
        formCode: form.code,
        version: fv.version,
        status: (['ACTIVE', 'DRAFT', 'RETIRED'].includes(fv.status)
          ? fv.status
          : 'DRAFT') as StatusKey,
        effectiveFrom: fv.effectiveFrom,
        effectiveTo: fv.effectiveTo,
      })),
    );
    return {
      code: proc.code,
      name: proc.name,
      agency: proc.agency,
      sector: proc.sector,
      sourceUrl: safeHttpsUrl(proc.sourceUrl),
      lastCheckedAt: proc.lastCheckedAt,
      version: activeVersion?.version ?? null,
      legalBasisText: activeVersion?.legalBasisText ?? null,
      formVersions,
    };
  });
}

export default async function SourcesPage() {
  let catalog: Awaited<ReturnType<typeof loadCatalog>> = [];
  let loadError = false;
  try {
    catalog = await loadCatalog();
  } catch (_) {
    loadError = true;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold uppercase tracking-wider">
            Nguồn &amp; căn cứ pháp lý
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Nguồn dữ liệu và phiên bản
          </h1>
          <p className="max-w-3xl text-lg text-slate-500 leading-relaxed">
            Mỗi thủ tục dưới đây kèm nguồn chính thức, phiên bản đang hiệu lực,
            ngày rà soát gần nhất và căn cứ pháp lý. Dữ liệu demo được chuẩn hóa
            từ nguồn công khai; hệ thống chưa kết nối trực tiếp với cơ sở dữ liệu
            nội bộ của cơ quan nhà nước.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 transition-colors"
          >
            ← Quay lại Trang chủ
          </Link>
        </div>

        {loadError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6 text-sm leading-relaxed">
            Chưa tải được danh mục thủ tục. Hãy chắc chắn cơ sở dữ liệu đã được
            khởi tạo (<code className="font-mono">npm run db:push</code> rồi{' '}
            <code className="font-mono">npm run db:seed</code>) và thử lại.
          </div>
        )}

        {!loadError && catalog.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
            Chưa có thủ tục nào trong danh mục.
          </div>
        )}

        <div className="space-y-6">
          {catalog.map((item) => {
            const checked = formatDate(item.lastCheckedAt);
            return (
              <section
                key={item.code}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {item.name}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {item.agency} · Lĩnh vực {item.sector} ·{' '}
                      <span className="font-mono text-xs">{item.code}</span>
                    </p>
                  </div>
                  {item.version && (
                    <span className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      Phiên bản {item.version}
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-400 font-medium">Nguồn chính thức</dt>
                    <dd className="mt-1">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-600 hover:text-amber-700 underline break-all font-medium"
                        >
                          {item.sourceUrl}
                        </a>
                      ) : (
                        <span className="text-slate-500">Không có</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">Rà soát gần nhất</dt>
                    <dd className="mt-1 text-slate-700 font-medium">
                      {checked ?? 'Chưa rõ'}
                    </dd>
                  </div>
                </dl>

                {item.legalBasisText && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Căn cứ pháp lý
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {item.legalBasisText}
                    </p>
                  </div>
                )}

                {item.formVersions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Phiên bản biểu mẫu
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {item.formVersions.map((fv, idx) => {
                        const from = formatDate(fv.effectiveFrom);
                        const to = formatDate(fv.effectiveTo);
                        const range = from
                          ? ` · ${from}${to ? ` → ${to}` : ' → nay'}`
                          : '';
                        return (
                          <li
                            key={`${fv.formCode}-${fv.version}-${idx}`}
                            className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-medium ${STATUS_STYLES[fv.status]}`}
                          >
                            {fv.formCode} v{fv.version} · {STATUS_LABELS[fv.status]}
                            <span className="text-slate-400 ml-1">{range}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <footer className="pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-400 italic leading-relaxed">
            {DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
