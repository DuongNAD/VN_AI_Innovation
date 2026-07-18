'use client';

import { useEffect, useRef, useState } from 'react';

type AttachmentPreviewLinkProps = {
  applicationId: string;
  fieldId: string;
  fileName: string;
  token?: string;
  compact?: boolean;
};

export default function AttachmentPreviewLink({
  applicationId,
  fieldId,
  fileName,
  token,
  compact = false,
}: AttachmentPreviewLinkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; mimeType: string } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const closePreview = () => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  useEffect(() => {
    if (preview) {
      closeButtonRef.current?.focus();
    }
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const openPreview = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/applications/${encodeURIComponent(applicationId)}/attachments/${encodeURIComponent(fieldId)}`,
        {
          headers: token ? { 'X-Session-Token': token } : undefined,
          cache: 'no-store',
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message ||
            'Không thể mở tệp. Tệp cũ có thể mới chỉ được lưu tên và cần tải lại.'
        );
      }
      const blob = await res.blob();
      setPreview({
        url: URL.createObjectURL(blob),
        mimeType: blob.type || res.headers.get('content-type') || 'application/octet-stream',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể mở tệp đính kèm.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        disabled={loading}
        className={
          compact
            ? 'no-print inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60'
            : 'no-print inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-60'
        }
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" strokeWidth={1.8} />
        </svg>
        {loading ? 'Đang mở…' : 'Xem trước'}
      </button>

      {error && (
        <p className="no-print mt-1 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {preview && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Xem trước ${fileName}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closePreview();
          }}
        >
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900">{fileName}</p>
                <p className="text-xs text-slate-500">Tệp riêng tư của hồ sơ</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={preview.url}
                  download={fileName}
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tải xuống
                </a>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closePreview}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xl text-slate-700 hover:bg-slate-200"
                  aria-label="Đóng xem trước"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              {preview.mimeType === 'application/pdf' ? (
                <iframe
                  src={preview.url}
                  title={`Xem trước ${fileName}`}
                  className="h-full min-h-[70vh] w-full rounded-lg bg-white"
                />
              ) : preview.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={`Nội dung tệp ${fileName}`}
                  className="mx-auto max-h-full max-w-full rounded-lg bg-white object-contain shadow-sm"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-slate-600">
                  Định dạng này không thể xem trực tiếp. Vui lòng tải tệp xuống.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
