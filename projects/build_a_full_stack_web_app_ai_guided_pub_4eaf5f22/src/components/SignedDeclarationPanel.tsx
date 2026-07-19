'use client';

import { useRef, useState } from 'react';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES } from '@/lib/application-attachments';
import AttachmentPreviewLink from '@/components/AttachmentPreviewLink';

export type SignatureCheck = {
  status: 'PASSED' | 'REVIEW' | 'REJECTED' | 'SKIPPED';
  reason?: string;
  confidence?: number;
};

export type SignedDeclaration = {
  fileName: string;
  uploadedAt?: string | Date | null;
  check?: SignatureCheck | null;
};

const CHECK_STYLES: Record<
  SignatureCheck['status'],
  { label: string; badge: string; icon: string }
> = {
  PASSED: {
    label: 'AI: đã nhận diện tờ khai có chữ ký',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    icon: '🤖✅',
  },
  REVIEW: {
    label: 'AI: cần cán bộ kiểm tra thêm',
    badge: 'border-amber-200 bg-amber-100 text-amber-800',
    icon: '🤖⚠️',
  },
  REJECTED: {
    label: 'AI: chưa đạt',
    badge: 'border-rose-200 bg-rose-100 text-rose-800',
    icon: '🤖⛔',
  },
  SKIPPED: {
    label: 'Chưa kiểm tra tự động',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
    icon: 'ℹ️',
  },
};

type SignedDeclarationPanelProps = {
  applicationId: string;
  token: string;
  signed: SignedDeclaration | null;
  /** Only DRAFT / RETURNED applications can change their signed copy. */
  editable: boolean;
  onSignedChange(next: SignedDeclaration | null): void;
};

const ACCEPT_TYPES = ATTACHMENT_ACCEPT.split(',');

export default function SignedDeclarationPanel({
  applicationId,
  token,
  signed,
  editable,
  onSignedChange,
}: SignedDeclarationPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signedUrl = `/api/v1/applications/${encodeURIComponent(applicationId)}/signed-declaration`;
  const checkStatus = signed?.check?.status;
  const checkPassed = checkStatus === 'PASSED';
  const checkPending = checkStatus === 'REVIEW' || checkStatus === 'SKIPPED';

  const upload = async (file: File) => {
    if (busy) return;
    if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
      setError('Tệp phải có dung lượng từ 1 byte đến 10 MB.');
      return;
    }
    if (file.type && !ACCEPT_TYPES.includes(file.type)) {
      setError('Chỉ chấp nhận tệp PDF hoặc ảnh JPG, PNG, WebP.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(signedUrl, {
        method: 'POST',
        headers: { 'X-Session-Token': token },
        body,
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error?.message || 'Không thể tải tờ khai đã ký lên.');
      }
      onSignedChange({
        fileName: result.fileName,
        uploadedAt: new Date().toISOString(),
        check: result.check ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải tờ khai đã ký lên.');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove');
    setError(null);
    try {
      const res = await fetch(signedUrl, {
        method: 'DELETE',
        headers: { 'X-Session-Token': token },
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(result?.error?.message || 'Không thể gỡ tờ khai đã ký.');
      }
      onSignedChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gỡ tờ khai đã ký.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label="Tờ khai đã ký"
      className={`card border p-6 ${
        checkPassed
          ? 'border-emerald-300 bg-emerald-50'
          : checkPending
            ? 'border-amber-300 bg-amber-50'
            : signed
              ? 'border-slate-300 bg-slate-50'
              : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          {checkPassed ? '✅' : signed ? '⏳' : '✍️'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {checkPassed
              ? 'Tờ khai đã được kiểm tra'
              : signed
                ? 'Đã tải tờ khai - cần kiểm tra'
                : 'Ký tờ khai trước khi nộp'}
          </h2>
          <p className="mt-1 text-base text-slate-600">
            {checkPassed
              ? 'Hệ thống đã nhận diện đây là tờ khai có chữ ký. Bạn có thể xem lại hoặc tiếp tục nộp hồ sơ.'
              : signed
                ? 'Tệp đã được tải lên nhưng chưa được xác nhận hoàn toàn; trạng thái kiểm tra được hiển thị bên dưới.'
              : 'Tải PDF ở phần “Xem trước tờ khai”, ký tay rồi chụp/scan (hoặc ký số), sau đó tải bản đã ký lên đây. Bắt buộc phải có tờ khai đã ký mới nộp được hồ sơ.'}
          </p>

          {signed && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold ${
                    checkPassed
                      ? 'border-emerald-200 text-emerald-800'
                      : checkPending
                        ? 'border-amber-200 text-amber-800'
                        : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <span aria-hidden="true">📄</span>
                  <span className="max-w-[16rem] truncate">{signed.fileName}</span>
                </span>
                <AttachmentPreviewLink
                  applicationId={applicationId}
                  fieldId="signed-declaration"
                  fileName={signed.fileName}
                  token={token}
                  url={signedUrl}
                  compact
                  label="Xem lại"
                />
              </div>
              {signed.check && (
                <div className="mt-3 space-y-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      CHECK_STYLES[signed.check.status].badge
                    }`}
                  >
                    <span aria-hidden="true">{CHECK_STYLES[signed.check.status].icon}</span>
                    {CHECK_STYLES[signed.check.status].label}
                  </span>
                  {signed.check.reason && (
                    <p className="text-xs text-slate-500">{signed.check.reason}</p>
                  )}
                </div>
              )}
            </>
          )}

          {editable && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy !== null}
                className={`btn ${
                  signed
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                } disabled:opacity-50`}
              >
                {busy === 'upload'
                  ? 'Đang tải lên…'
                  : signed
                    ? 'Thay tờ khai đã ký'
                    : 'Tải lên tờ khai đã ký'}
              </button>
              {signed && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy !== null}
                  className="btn border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {busy === 'remove' ? 'Đang gỡ…' : 'Gỡ bỏ'}
                </button>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Chấp nhận PDF, JPG, PNG hoặc WebP, tối đa 10 MB. Lưu ý: nếu bạn sửa lại thông tin hoặc
            tệp đính kèm, tờ khai đã ký sẽ bị gỡ để bạn ký lại đúng nội dung mới.
          </p>

          {error && (
            <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
