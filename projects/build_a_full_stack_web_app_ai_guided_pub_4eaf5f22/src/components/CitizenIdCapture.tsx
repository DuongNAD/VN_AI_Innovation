'use client';

import jsQR from 'jsqr';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { parseCitizenIdQr, type CitizenIdScanData } from '@/lib/citizen-id';

type Props = {
  onDetected: (data: CitizenIdScanData) => void;
};

type StoredDocument = {
  status: string;
  expiresAt: string;
} | null;

function ImagePreview({ file, alt }: { file: File; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt={alt} className="h-full w-full object-cover" />;
}

async function drawFile(file: File, maxDimension: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error('Thiết bị không hỗ trợ xử lý ảnh.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

async function scanQr(file: File): Promise<CitizenIdScanData | null> {
  const canvas = await drawFile(file, 2400);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result ? parseCitizenIdQr(result.data) : null;
}

async function compressForUpload(file: File, name: string): Promise<File> {
  const canvas = await drawFile(file, 1800);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Không thể chuẩn bị ảnh.'))),
      'image/jpeg',
      0.86
    );
  });
  return new File([blob], name, { type: 'image/jpeg' });
}

function captureLabel(side: 'front' | 'back'): {
  title: string;
  hint: string;
  icon: string;
} {
  return side === 'front'
    ? { title: 'Mặt trước', hint: 'Ảnh chân dung và số định danh', icon: '①' }
    : { title: 'Mặt sau', hint: 'Mã QR, nơi cư trú và ngày cấp', icon: '②' };
}

function CaptureSlot({
  side,
  file,
  onChange,
}: {
  side: 'front' | 'back';
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const label = captureLabel(side);
  return (
    <label className="group relative block cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white transition hover:border-brand-400 hover:bg-brand-50/50">
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={onChange}
      />
      <span className="block aspect-[1.586/1]">
        {file ? (
          <ImagePreview file={file} alt={`Ảnh căn cước ${label.title.toLocaleLowerCase('vi')}`} />
        ) : (
          <span className="flex h-full flex-col items-center justify-center p-5 text-center">
            <span
              className="grid size-11 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-700"
              aria-hidden="true"
            >
              {label.icon}
            </span>
            <strong className="mt-3 text-slate-800">{label.title}</strong>
            <small className="mt-1 text-xs font-normal text-slate-500">{label.hint}</small>
            <span className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
              Chụp hoặc chọn ảnh
            </span>
          </span>
        )}
      </span>
      {file ? (
        <span className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-950/70 px-3 py-1.5 text-center text-xs font-semibold text-white backdrop-blur">
          Chạm để chụp lại {label.title.toLocaleLowerCase('vi')}
        </span>
      ) : null}
    </label>
  );
}

export default function CitizenIdCapture({ onDetected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontData, setFrontData] = useState<CitizenIdScanData | null>(null);
  const [backData, setBackData] = useState<CitizenIdScanData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<StoredDocument>(null);

  const detected = useMemo(
    () => ({ ...(frontData ?? {}), ...(backData ?? {}) }),
    [frontData, backData]
  );
  const detectedCount = Object.values(detected).filter(Boolean).length;

  useEffect(() => {
    let active = true;
    fetch('/api/v1/identity-document', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { document?: StoredDocument } | null) => {
        if (active && result?.document) setStored(result.document);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function selectImage(side: 'front' | 'back', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setError(null);
    setMessage(null);
    if (side === 'front') {
      setFront(file);
      setFrontData(null);
    } else {
      setBack(file);
      setBackData(null);
    }

    setScanning(true);
    try {
      const data = await scanQr(file);
      if (side === 'front') setFrontData(data);
      else setBackData(data);
      setMessage(
        data
          ? 'Đã đọc được mã QR. Hãy chụp đủ hai mặt rồi kiểm tra thông tin bên dưới.'
          : 'Chưa đọc được QR trên ảnh này. Bạn vẫn có thể lưu ảnh và nhập thông tin thủ công.'
      );
    } catch {
      setMessage('Không thể đọc QR trên ảnh này. Bạn vẫn có thể nhập thông tin thủ công.');
    } finally {
      setScanning(false);
    }
  }

  async function saveCapture() {
    if (!front || !back) {
      setError('Vui lòng chụp đủ mặt trước và mặt sau căn cước.');
      return;
    }
    if (!consent) {
      setError('Bạn cần đồng ý việc xử lý và lưu tạm hai ảnh căn cước.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const [frontUpload, backUpload] = await Promise.all([
        compressForUpload(front, 'can-cuoc-mat-truoc.jpg'),
        compressForUpload(back, 'can-cuoc-mat-sau.jpg'),
      ]);
      const form = new FormData();
      form.append('front', frontUpload);
      form.append('back', backUpload);
      form.append('consent', 'true');
      const response = await fetch('/api/v1/identity-document', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const result = (await response.json()) as {
        document?: StoredDocument;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message || 'Không thể lưu ảnh căn cước.');
      }
      if (detectedCount > 0) onDetected(detected);
      setStored(result.document ?? null);
      setMessage(
        detectedCount > 0
          ? `Đã tự điền ${detectedCount} thông tin. Vui lòng kiểm tra rồi bấm “Lưu thay đổi”.`
          : 'Đã lưu hai ảnh. Vui lòng nhập và kiểm tra thông tin bên dưới.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu ảnh căn cước.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCapture() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/identity-document', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Không thể xóa ảnh căn cước.');
      setStored(null);
      setFront(null);
      setBack(null);
      setFrontData(null);
      setBackData(null);
      setMessage('Đã xóa hai ảnh căn cước.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xóa ảnh căn cước.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-xl text-white shadow-md"
            aria-hidden="true"
          >
            ▣
          </span>
          <div>
            <h3 className="font-extrabold text-slate-900">Quét căn cước để tự điền</h3>
            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
              Đọc QR ngay trên thiết bị, không gửi ảnh cho mô hình AI.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-10 rounded-xl border border-brand-200 bg-white px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50"
          aria-expanded={expanded}
        >
          {expanded ? 'Thu gọn' : stored ? 'Chụp lại' : 'Bắt đầu quét'}
        </button>
      </div>

      {stored ? (
        <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 sm:mx-5">
          <span>
            <strong>Đã lưu hai mặt · Chưa xác thực danh tính</strong>
            <span className="ml-1 text-amber-700">
              Tự xóa sau {new Date(stored.expiresAt).toLocaleDateString('vi-VN')}.
            </span>
          </span>
          <button
            type="button"
            onClick={deleteCapture}
            disabled={saving}
            className="min-h-8 rounded-lg px-2.5 py-1 font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Xóa ảnh
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="border-t border-brand-100 bg-white/80 p-4 sm:p-5">
          <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Đặt thẻ trên nền tối, đủ sáng, không lóa và để trọn bốn góc trong khung. Hệ thống
            chỉ đọc QR để hỗ trợ nhập liệu; ảnh không phải bằng chứng xác thực danh tính.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CaptureSlot
              side="front"
              file={front}
              onChange={(event) => selectImage('front', event)}
            />
            <CaptureSlot
              side="back"
              file={back}
              onChange={(event) => selectImage('back', event)}
            />
          </div>

          {scanning ? (
            <p className="mt-3 text-sm font-semibold text-brand-700" role="status">
              Đang đọc mã QR trên ảnh…
            </p>
          ) : null}

          {detectedCount > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Đã tìm thấy {detectedCount} trường thông tin từ QR. Bạn vẫn cần kiểm tra lại trước
              khi lưu hồ sơ.
            </div>
          ) : null}

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 size-5 min-h-0 min-w-0 accent-brand-600"
            />
            <span>
              Tôi đồng ý cho hệ thống xử lý và lưu mã hóa hai ảnh căn cước tối đa 30 ngày để
              chuẩn bị hồ sơ. Tôi có thể xóa ảnh bất cứ lúc nào.
            </span>
          </label>

          {message ? (
            <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={saveCapture}
            disabled={saving || scanning}
            className="mt-4 min-h-11 w-full rounded-xl bg-brand-600 px-5 py-2.5 font-bold text-white shadow-md hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Đang mã hóa và lưu…' : 'Lưu ảnh và tự điền thông tin'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
