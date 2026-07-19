'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type MyApplication = {
  id: string;
  status: string;
  formCode: string;
  formVersion: string;
  procedureName: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  hasSignedDeclaration: boolean;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Bản nháp', badge: 'border-slate-200 bg-slate-100 text-slate-700' },
  SUBMITTED: { label: 'Chờ duyệt', badge: 'border-amber-200 bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Đã duyệt', badge: 'border-emerald-200 bg-emerald-100 text-emerald-800' },
  RETURNED: { label: 'Bị trả lại', badge: 'border-rose-200 bg-rose-100 text-rose-800' },
};

function formatDateTime(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyApplicationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<MyApplication[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/me/applications', { credentials: 'include', cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error?.message || 'Không tải được danh sách hồ sơ.');
        }
        if (!cancelled) {
          setApps(Array.isArray(body?.applications) ? body.applications : []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lỗi kết nối hệ thống.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/user" className="catalog-back-link">
        <span aria-hidden="true">←</span>
        Trang chủ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Hồ sơ của tôi</h1>
        <p className="mt-1 text-slate-600">
          Danh sách các hồ sơ bạn đã tạo và nộp. Bấm vào một hồ sơ để xem trạng thái xét duyệt và tờ khai đã ký.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-slate-900" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800" role="alert">
          {error}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">Bạn chưa có hồ sơ nào</p>
          <p className="mt-1">Hãy bắt đầu một thủ tục từ trang chủ để tạo hồ sơ đầu tiên.</p>
          <Link
            href="/user"
            className="btn mt-4 inline-flex bg-brand-600 text-white hover:bg-brand-700"
          >
            Bắt đầu thủ tục
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {apps.map((app) => {
            const meta = STATUS_META[app.status] ?? STATUS_META.DRAFT;
            return (
              <li key={app.id}>
                <Link
                  href={`/user/result?applicationId=${encodeURIComponent(app.id)}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">{app.procedureName}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Biểu mẫu {app.formCode} · phiên bản {app.formVersion}
                    {app.submittedAt ? ` · nộp lúc ${formatDateTime(app.submittedAt)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    {app.hasSignedDeclaration && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <span aria-hidden="true">✍️</span> Đã có tờ khai ký
                      </span>
                    )}
                    {app.status === 'RETURNED' && app.reviewNote && (
                      <span className="text-rose-700">Lý do trả lại: {app.reviewNote}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
