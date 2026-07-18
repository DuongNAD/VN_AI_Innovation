'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { visibleFieldsFor } from '@/components/DynamicForm';
import { DocumentTypeBadge } from '@/components/DocumentTypeSelect';
import type { FieldDef } from '@/lib/schema-guards';
import { getDocumentTypeMeta, type DocumentTypeCode } from '@/lib/document-types';

type AppDetail = {
  id: string;
  status: 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  formCode: string;
  formVersion: string;
  procedureName: string;
  documentType: DocumentTypeCode | string;
  documentTypeLabel: string;
  documentTypeIcon: string;
  data: Record<string, unknown>;
  fields: FieldDef[];
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function statusLabel(status: string): { text: string; className: string } {
  if (status === 'SUBMITTED') {
    return {
      text: 'CHỜ DUYỆT',
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  if (status === 'APPROVED') {
    return {
      text: 'ĐÃ DUYỆT',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  // RETURNED — officer UI label requested as "CẦN BỔ SUNG"
  return {
    text: 'CẦN BỔ SUNG',
    className: 'bg-rose-100 text-rose-800 border-rose-200',
  };
}

function fmtValue(field: FieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '(trống)';
  if (field.options && field.options.length > 0) {
    const match = field.options.find(
      (o) => o.value === value || String(o.value) === String(value)
    );
    if (match) return match.label;
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

type Props = {
  applicationId: string;
  /** Where to return after approve/return (manager or admin home). */
  listHref?: string;
  canReview?: boolean;
};

export default function ApplicationReviewDetail({
  applicationId,
  listHref = '/manager',
  canReview = true,
}: Props): ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<AppDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'APPROVE' | 'RETURN' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/applications/${encodeURIComponent(applicationId)}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Không tải được hồ sơ.');
      }
      const row = body?.application;
      if (!row || typeof row !== 'object') {
        throw new Error('Phản hồi hồ sơ không hợp lệ.');
      }
      setApp(row as AppDetail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải hồ sơ.');
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: 'APPROVE' | 'RETURN') => {
    if (!canReview || busy) return;
    if (decision === 'RETURN' && note.trim() === '') {
      setError('Vui lòng ghi rõ lý do trả lại để người dân biết cần bổ sung gì.');
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/applications/${encodeURIComponent(applicationId)}/review`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            note: note.trim() === '' ? undefined : note.trim(),
          }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Không xử lý được hồ sơ.');
      }

      const msg =
        decision === 'APPROVE'
          ? 'Đã phê duyệt hồ sơ thành công'
          : 'Đã trả lại hồ sơ để người dân bổ sung';

      setToast(msg);
      // Brief toast then return to list with flash query for the list page.
      const flash = decision === 'APPROVE' ? 'approved' : 'returned';
      setTimeout(() => {
        router.push(`${listHref}?flash=${flash}`);
        router.refresh();
      }, 600);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.');
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="card border border-slate-100 p-10 text-center text-slate-500">
        Đang tải hồ sơ…
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Link href={listHref} className="text-sm font-semibold text-sky-700 hover:underline">
          ← Quay lại danh sách
        </Link>
        <div className="card border border-rose-200 bg-rose-50 p-6 text-rose-900" role="alert">
          {error || 'Không tìm thấy hồ sơ.'}
        </div>
      </div>
    );
  }

  const meta = getDocumentTypeMeta(app.documentType);
  const st = statusLabel(app.status);
  const title = app.documentTypeLabel || meta.label || app.procedureName;
  const isPending = app.status === 'SUBMITTED';

  const reviewFields = visibleFieldsFor(app.fields || [], app.data || {}).filter((f) => {
    const v = app.data[f.id];
    return v !== undefined && v !== null && v !== '';
  });
  const fallbackRows =
    reviewFields.length === 0
      ? Object.entries(app.data || {})
          .filter(
            ([k, v]) =>
              !k.startsWith('__') &&
              v !== undefined &&
              v !== null &&
              v !== '' &&
              typeof v !== 'object'
          )
          .map(([k, v]) => ({ id: k, label: k, value: String(v) }))
      : [];

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className="fixed right-4 top-4 z-50 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-lg"
          role="status"
        >
          ✅ {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={listHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
        >
          ← Quay lại danh sách hồ sơ
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Làm mới
        </button>
      </div>

      <div className="card space-y-4 border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              <span className="mr-2" aria-hidden>
                {meta.icon}
              </span>
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <DocumentTypeBadge code={app.documentType} />
              <span
                className={
                  'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ' + st.className
                }
              >
                {st.text}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Thủ tục: {app.procedureName} · Biểu mẫu{' '}
              <span className="font-mono font-semibold text-slate-700">{app.formCode}</span> · v
              {app.formVersion}
              <br />
              Nộp: {formatDate(app.submittedAt)}
              {app.reviewedAt
                ? ` · Xử lý: ${formatDate(app.reviewedAt)}${
                    app.reviewedBy ? ' bởi ' + app.reviewedBy : ''
                  }`
                : ''}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-1/3 px-4 py-2 text-left font-semibold text-slate-500">
                  Trường thông tin
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">Nội dung khai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {reviewFields.length === 0 && fallbackRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center italic text-slate-400">
                    Hồ sơ không có dữ liệu hiển thị.
                  </td>
                </tr>
              ) : reviewFields.length > 0 ? (
                reviewFields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{f.label}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {fmtValue(f, app.data[f.id])}
                    </td>
                  </tr>
                ))
              ) : (
                fallbackRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.label}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{row.value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {app.status === 'RETURNED' && app.reviewNote && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <span className="font-semibold">Lý do cần bổ sung:</span> {app.reviewNote}
          </div>
        )}
        {app.status === 'APPROVED' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            🎉 Hồ sơ đã được phê duyệt
            {app.reviewedBy ? ` bởi ${app.reviewedBy}` : ''}
            {app.reviewNote ? ` — ${app.reviewNote}` : '.'}
          </div>
        )}

        {isPending && canReview && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-semibold text-slate-800" htmlFor="return-note">
              Ghi chú cho người dân (bắt buộc khi trả lại)
            </label>
            <textarea
              id="return-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Bổ sung bản chụp trang thông tin CCCD của bên nữ."
              disabled={busy !== null}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void decide('APPROVE')}
                disabled={busy !== null}
                className="btn bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {busy === 'APPROVE' ? 'Đang phê duyệt…' : '✅ Phê duyệt hồ sơ'}
              </button>
              <button
                type="button"
                onClick={() => void decide('RETURN')}
                disabled={busy !== null || note.trim() === ''}
                className="btn bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {busy === 'RETURN' ? 'Đang trả lại…' : '↩ Trả lại để bổ sung'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Phê duyệt không cần ghi chú. Trả lại bắt buộc có lý do — người dân sẽ thấy ngay trên
              trang trạng thái hồ sơ.
            </p>
          </div>
        )}

        {isPending && !canReview && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Tài khoản hiện tại không có quyền xét duyệt hồ sơ.
          </p>
        )}
      </div>
    </div>
  );
}
