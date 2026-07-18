'use client';

import { useState } from 'react';
import Link from 'next/link';
import DocumentTypeSelect, { DocumentTypeBadge } from '@/components/DocumentTypeSelect';
import {
  inferDocumentType,
  type DocumentTypeCode,
} from '@/lib/document-types';

type SubmissionPanelProps = {
  applicationId: string;
  token: string;
  status: string;
  valid: boolean;
  formCode?: string;
  documentType?: string | null;
  submittedAt?: string | Date | null;
  reviewedAt?: string | Date | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  /** Called after submit/refresh so the page can re-render with the new status. */
  onStatusChange(next: {
    status: string;
    documentType?: string | null;
    submittedAt?: string | Date | null;
    reviewedAt?: string | Date | null;
    reviewedBy?: string | null;
    reviewNote?: string | null;
  }): void;
};

function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) {
    return '';
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Citizen-facing lifecycle panel on the result page: hand the validated
 * application over to the receiving agency, wait for the officer's decision,
 * and read the outcome (approved, or returned with the officer's note).
 */
export default function SubmissionPanel({
  applicationId,
  token,
  status,
  valid,
  formCode,
  documentType: documentTypeProp,
  submittedAt,
  reviewedAt,
  reviewedBy,
  reviewNote,
  onStatusChange,
}: SubmissionPanelProps) {
  const [busy, setBusy] = useState<'submit' | 'refresh' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<DocumentTypeCode>(() =>
    inferDocumentType(documentTypeProp || formCode)
  );

  const submit = async () => {
    if (busy) {
      return;
    }
    if (!documentType) {
      setErrorMsg('Vui lòng chọn loại đơn trước khi nộp.');
      return;
    }
    setBusy('submit');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/applications/' + applicationId + '/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token,
        },
        body: JSON.stringify({ documentType }),
      });
      const body: any = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.error?.code === 'ALREADY_SUBMITTED') {
          onStatusChange({ status: 'SUBMITTED', submittedAt: submittedAt ?? null });
          return;
        }
        setErrorMsg(body?.error?.message ?? 'Không nộp được hồ sơ. Vui lòng thử lại.');
        return;
      }
      onStatusChange({
        status: 'SUBMITTED',
        documentType: body?.documentType ?? documentType,
        submittedAt: body?.submittedAt ?? new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
      });
    } catch {
      setErrorMsg('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    if (busy) {
      return;
    }
    setBusy('refresh');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/applications/' + applicationId, {
        headers: { 'X-Session-Token': token },
      });
      const body: any = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setErrorMsg(body?.error?.message ?? 'Không tải được trạng thái hồ sơ.');
        return;
      }
      if (typeof body.documentType === 'string') {
        setDocumentType(inferDocumentType(body.documentType));
      }
      onStatusChange({
        status: typeof body.status === 'string' ? body.status : status,
        documentType: body.documentType ?? documentType,
        submittedAt: body.submittedAt ?? null,
        reviewedAt: body.reviewedAt ?? null,
        reviewedBy: body.reviewedBy ?? null,
        reviewNote: body.reviewNote ?? null,
      });
    } catch {
      setErrorMsg('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const errorBox = errorMsg && (
    <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-base text-red-800" role="alert">
      {errorMsg}
    </div>
  );

  const typeBadge = (
    <div className="mt-3">
      <DocumentTypeBadge code={documentTypeProp || documentType} />
    </div>
  );

  if (status === 'APPROVED') {
    return (
      <div className="card border border-emerald-300 bg-emerald-50 p-6" role="status">
        <h2 className="text-xl font-bold text-emerald-950">✅ Hồ sơ đã được phê duyệt</h2>
        {typeBadge}
        <p className="mt-2 text-lg text-emerald-900">
          {(reviewedBy || 'Cán bộ tiếp nhận') +
            (formatDateTime(reviewedAt) ? ' đã duyệt lúc ' + formatDateTime(reviewedAt) : ' đã duyệt hồ sơ')}
          . Bạn có thể in tờ khai bên dưới và mang theo giấy tờ gốc khi đến nhận kết quả.
        </p>
        {reviewNote && (
          <p className="mt-2 text-lg text-emerald-900">
            <span className="font-semibold">Ghi chú của cán bộ:</span> {reviewNote}
          </p>
        )}
      </div>
    );
  }

  if (status === 'RETURNED') {
    return (
      <div className="card border-l-4 border border-amber-300 border-l-amber-500 bg-amber-50 p-6" role="alert">
        <h2 className="text-xl font-bold text-amber-950">Hồ sơ cần bổ sung</h2>
        {typeBadge}
        {reviewNote && (
          <p className="mt-2 text-lg text-amber-900">
            <span className="font-semibold">Lý do cán bộ trả lại:</span> {reviewNote}
          </p>
        )}
        <p className="mt-2 text-base text-amber-800">
          {(reviewedBy || 'Cán bộ tiếp nhận') +
            (formatDateTime(reviewedAt) ? ' · ' + formatDateTime(reviewedAt) : '')}
        </p>
        <div className="mt-4 space-y-3">
          <DocumentTypeSelect
            value={documentType}
            onChange={setDocumentType}
            disabled={busy !== null}
            variant="select"
            label="Xác nhận lại loại đơn khi nộp lại"
          />
          <div className="flex flex-wrap gap-3">
            <Link
              href={'/user/form/' + applicationId}
              className="btn bg-amber-600 text-white hover:bg-amber-700"
            >
              Sửa hồ sơ theo yêu cầu
            </Link>
            {valid && (
              <button
                type="button"
                onClick={submit}
                disabled={busy !== null}
                className="btn border border-amber-600 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {busy === 'submit' ? 'Đang nộp lại...' : 'Nộp lại hồ sơ ngay'}
              </button>
            )}
          </div>
        </div>
        {errorBox}
      </div>
    );
  }

  if (status === 'SUBMITTED') {
    return (
      <div className="card border border-blue-300 bg-blue-50 p-6" role="status">
        <h2 className="text-xl font-bold text-blue-950">Hồ sơ đã nộp — đang chờ cán bộ xét duyệt</h2>
        {typeBadge}
        <p className="mt-2 text-lg text-blue-900">
          {formatDateTime(submittedAt)
            ? 'Thời điểm nộp: ' + formatDateTime(submittedAt) + '. '
            : ''}
          Cán bộ tiếp nhận sẽ kiểm tra và phản hồi; kết quả hiển thị ngay tại trang này.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy !== null}
          className="btn mt-4 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy === 'refresh' ? 'Đang cập nhật...' : 'Cập nhật trạng thái'}
        </button>
        {errorBox}
      </div>
    );
  }

  // DRAFT (or any unknown status): offer submission only when the rule engine
  // found no blocking errors.
  if (!valid) {
    return null;
  }
  return (
    <div className="card border border-blue-300 bg-blue-50 p-6">
      <h2 className="text-xl font-bold text-blue-950">Nộp hồ sơ cho cơ quan tiếp nhận</h2>
      <p className="mt-2 text-lg text-blue-900">
        Hồ sơ đã qua kiểm tra và không còn lỗi. Chọn loại đơn, rồi nộp để chuyển tới cán bộ một cửa
        xét duyệt; kết quả sẽ trả về ngay trang này.
      </p>
      <div className="mt-4 rounded-xl border border-blue-200 bg-white/80 p-4">
        <DocumentTypeSelect
          value={documentType}
          onChange={setDocumentType}
          disabled={busy !== null}
          variant="cards"
          label="Chọn loại đơn trước khi nộp"
          helpText="Bắt buộc — giúp cán bộ lọc và ưu tiên hàng chờ theo đúng thủ tục."
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy !== null || !documentType}
        className="btn mt-4 bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {busy === 'submit' ? 'Đang nộp hồ sơ...' : 'Nộp hồ sơ để cán bộ duyệt'}
      </button>
      {errorBox}
    </div>
  );
}
