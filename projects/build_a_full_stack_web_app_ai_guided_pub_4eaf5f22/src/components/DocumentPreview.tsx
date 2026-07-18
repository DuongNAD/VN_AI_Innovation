'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldDef } from '@/lib/schema-guards';
import AttachmentPreviewLink from '@/components/AttachmentPreviewLink';

type DocumentPreviewProps = {
  applicationId: string;
  token: string;
  procedureName: string;
  formCode: string;
  formVersion: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
};

const DOTS = '………………………………';

function pdfFileName(procedureName: string): string {
  const slug = procedureName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `to-khai-${slug || 'thu-tuc'}.pdf`;
}

function fmtDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return DOTS;
  }
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/** Format a raw stored value for display using the field's option labels when available. */
function fmtValue(field: FieldDef | undefined, value: unknown): string {
  if (isEmpty(value)) {
    return DOTS;
  }
  if (field?.options && field.options.length > 0) {
    const match = field.options.find((o) => o.value === value || String(o.value) === String(value));
    if (match) {
      return match.label;
    }
  }
  if (field?.type === 'date') {
    return fmtDate(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('vi-VN');
  }
  return String(value);
}

function todayLine(): string {
  const now = new Date();
  return `ngày ${String(now.getDate()).padStart(2, '0')} tháng ${String(now.getMonth() + 1).padStart(2, '0')} năm ${now.getFullYear()}`;
}

function NationalHeader() {
  return (
    <div className="text-center space-y-1">
      <p className="font-bold uppercase tracking-wide text-[15px]">
        Cộng hòa xã hội chủ nghĩa Việt Nam
      </p>
      <p className="font-bold text-[15px]">Độc lập – Tự do – Hạnh phúc</p>
      <p aria-hidden="true" className="leading-none">
        ―――――――――
      </p>
    </div>
  );
}

function SignatureRow({ leftTitle, leftName, rightTitle, rightName }: {
  leftTitle: string; leftName: string; rightTitle: string; rightName: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-8 text-center">
      <div>
        <p className="font-bold">{leftTitle}</p>
        <p className="italic text-[13px]">(Ký, ghi rõ họ tên)</p>
        <p className="mt-16 font-semibold">{leftName}</p>
      </div>
      <div>
        <p className="font-bold">{rightTitle}</p>
        <p className="italic text-[13px]">(Ký, ghi rõ họ tên)</p>
        <p className="mt-16 font-semibold">{rightName}</p>
      </div>
    </div>
  );
}

function FileValue({
  applicationId,
  token,
  field,
  value,
}: {
  applicationId: string;
  token: string;
  field: FieldDef;
  value: unknown;
}) {
  const fileName = typeof value === 'string' ? value : '';
  if (!fileName) return <>{DOTS}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{fileName}</span>
      <AttachmentPreviewLink
        applicationId={applicationId}
        fieldId={field.id}
        fileName={fileName}
        token={token}
        compact
      />
    </span>
  );
}

/** Official-styled marriage declaration (Tờ khai đăng ký kết hôn). */
function MarriageDocument({
  applicationId,
  token,
  fields,
  data,
}: {
  applicationId: string;
  token: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
}) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const val = (id: string) => fmtValue(byId.get(id), data[id]);
  const has = (id: string) => !isEmpty(data[id]);

  const previouslyMarried = data.previously_married === true;
  const priorMarriages = Number(data.marriage_number);
  const marriageOrder =
    previouslyMarried && Number.isFinite(priorMarriages) && priorMarriages > 0
      ? `lần thứ ${priorMarriages + 1}`
      : 'lần đầu';

  const pairRows: { label: string; male: string; female: string }[] = [
    { label: 'Họ, chữ đệm, tên', male: val('male_full_name'), female: val('female_full_name') },
    { label: 'Ngày, tháng, năm sinh', male: fmtDate(data.male_birth_date), female: fmtDate(data.female_birth_date) },
    {
      label: 'Số định danh cá nhân/CCCD',
      male: val('male_identity_number'),
      female: val('female_identity_number'),
    },
  ];

  const addressRows: { label: string; value: string }[] = [];
  if (has('residence') || byId.has('residence')) {
    addressRows.push({ label: 'Nơi cư trú', value: val('residence') });
  }
  if (byId.has('permanent_address')) {
    addressRows.push({ label: 'Địa chỉ thường trú', value: val('permanent_address') });
  }
  if (byId.has('temporary_address')) {
    addressRows.push({ label: 'Địa chỉ tạm trú', value: val('temporary_address') });
  }
  if (byId.has('phone_number')) {
    addressRows.push({ label: 'Số điện thoại liên hệ', value: val('phone_number') });
  }

  return (
    <div className="space-y-5">
      <NationalHeader />

      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold uppercase tracking-wide">Tờ khai đăng ký kết hôn</h2>
        <p className="italic">
          Kính gửi: Ủy ban nhân dân cấp xã{has('province') ? `, ${val('province')}` : ''}
        </p>
      </div>

      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            <th className="border border-slate-500 px-3 py-2 w-[30%] text-left align-middle">Nội dung</th>
            <th className="border border-slate-500 px-3 py-2 text-left">Bên nam</th>
            <th className="border border-slate-500 px-3 py-2 text-left">Bên nữ</th>
          </tr>
        </thead>
        <tbody>
          {pairRows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-500 px-3 py-2 font-semibold">{row.label}</td>
              <td className="border border-slate-500 px-3 py-2">{row.male}</td>
              <td className="border border-slate-500 px-3 py-2">{row.female}</td>
            </tr>
          ))}
          {addressRows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-500 px-3 py-2 font-semibold">{row.label}</td>
              <td className="border border-slate-500 px-3 py-2" colSpan={2}>{row.value}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-500 px-3 py-2 font-semibold">Đăng ký kết hôn</td>
            <td className="border border-slate-500 px-3 py-2" colSpan={2}>{marriageOrder}</td>
          </tr>
          {previouslyMarried && has('divorce_document') && byId.has('divorce_document') && (
            <tr>
              <td className="border border-slate-500 px-3 py-2 font-semibold">Trích lục ly hôn kèm theo</td>
              <td className="border border-slate-500 px-3 py-2" colSpan={2}>
                <FileValue
                  applicationId={applicationId}
                  token={token}
                  field={byId.get('divorce_document')!}
                  value={data.divorce_document}
                />
              </td>
            </tr>
          )}
          <tr>
            <td className="border border-slate-500 px-3 py-2 font-semibold">Hình thức nộp hồ sơ</td>
            <td className="border border-slate-500 px-3 py-2" colSpan={2}>{val('submission_channel')}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-justify leading-relaxed">
        Chúng tôi cam đoan những lời khai trên đây là đúng sự thật, việc kết hôn của chúng tôi là
        tự nguyện, không vi phạm quy định của Luật Hôn nhân và gia đình Việt Nam, và chịu hoàn toàn
        trách nhiệm trước pháp luật về nội dung đã khai.
      </p>

      <p className="text-right italic">…………, {todayLine()}</p>

      <SignatureRow
        leftTitle="Bên nam"
        leftName={val('male_full_name')}
        rightTitle="Bên nữ"
        rightName={val('female_full_name')}
      />
    </div>
  );
}

/** Generic declaration layout for any other form: label/value rows. */
function GenericDocument({ applicationId, token, procedureName, fields, data }: {
  applicationId: string;
  token: string;
  procedureName: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
}) {
  const rows = fields
    .filter((f) => f.type !== 'file' || !isEmpty(data[f.id]))
    .map((f) => ({ field: f, label: f.label, value: data[f.id] }));

  return (
    <div className="space-y-5">
      <NationalHeader />
      <div className="text-center">
        <h2 className="text-xl font-bold uppercase tracking-wide">Tờ khai {procedureName}</h2>
      </div>
      <table className="w-full border-collapse text-[15px]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border border-slate-500 px-3 py-2 w-[38%] font-semibold">{row.label}</td>
              <td className="border border-slate-500 px-3 py-2">
                {row.field.type === 'file' ? (
                  <FileValue
                    applicationId={applicationId}
                    token={token}
                    field={row.field}
                    value={row.value}
                  />
                ) : (
                  fmtValue(row.field, row.value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-justify leading-relaxed">
        Tôi cam đoan những lời khai trên đây là đúng sự thật và chịu trách nhiệm trước pháp luật về
        nội dung đã khai.
      </p>
      <p className="text-right italic">…………, {todayLine()}</p>
      <div className="text-center w-1/2 ml-auto">
        <p className="font-bold">Người khai</p>
        <p className="italic text-[13px]">(Ký, ghi rõ họ tên)</p>
      </div>
    </div>
  );
}

export default function DocumentPreview({
  applicationId,
  token,
  procedureName,
  formCode,
  formVersion,
  fields,
  data,
}: DocumentPreviewProps) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    return () => {
      if (generatedPdf) URL.revokeObjectURL(generatedPdf.url);
    };
  }, [generatedPdf]);

  const handleExportPdf = async () => {
    if (!documentRef.current || exporting) return;
    setExporting(true);
    setExportError(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(documentRef.current, {
        scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 900,
        onclone: (clonedDocument) => {
          const clonedSheet = clonedDocument.querySelector<HTMLElement>('[data-pdf-document]');
          if (!clonedSheet) return;
          clonedSheet.querySelectorAll('.no-print, .no-pdf').forEach((node) => node.remove());
          clonedSheet.style.width = '794px';
          clonedSheet.style.maxWidth = '794px';
          clonedSheet.style.padding = '36px 44px';
          clonedSheet.style.border = '0';
          clonedSheet.style.borderRadius = '0';
          clonedSheet.style.boxShadow = 'none';
          clonedSheet.style.overflow = 'visible';
        },
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      let renderWidth = maxWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      if (renderHeight > maxHeight) {
        renderHeight = maxHeight;
        renderWidth = (canvas.width * renderHeight) / canvas.height;
      }

      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;
      pdf.setProperties({
        title: `Tờ khai ${procedureName}`,
        subject: `Biểu mẫu ${procedureName} phiên bản ${formVersion}`,
        creator: 'VN AI Innovation',
      });
      pdf.addImage(canvas, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');

      const fileName = pdfFileName(procedureName);
      const url = URL.createObjectURL(pdf.output('blob'));
      setGeneratedPdf((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { url, fileName };
      });

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = fileName;
      downloadLink.click();
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportError('Không thể tạo tệp PDF. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-label="Xem trước tờ khai" className="space-y-4">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Xem trước tờ khai</h2>
          <p className="text-sm text-slate-500">
            Tải PDF để kiểm tra, in, ký và bổ sung vào hồ sơ của bạn.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all duration-200 disabled:cursor-wait disabled:opacity-70"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {exporting ? 'Đang tạo PDF…' : 'Tải tờ khai PDF'}
          </button>
          {exportError && (
            <p className="text-sm font-semibold text-red-700" role="alert">
              {exportError}
            </p>
          )}
          {generatedPdf && (
            <a
              href={generatedPdf.url}
              download={generatedPdf.fileName}
              className="text-sm font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900"
            >
              Tải lại tệp PDF vừa tạo
            </a>
          )}
        </div>
      </div>

      <div className="print-area">
        <div
          ref={documentRef}
          data-pdf-document
          className="document-sheet relative overflow-hidden bg-white border border-slate-300 rounded-lg shadow-sm px-6 py-8 sm:px-10 font-serif text-slate-900"
        >
          <span
            aria-hidden="true"
            className="no-pdf document-watermark pointer-events-none select-none absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl font-bold uppercase tracking-widest text-slate-900/[0.06] rotate-[-24deg]"
          >
            Bản xem trước
          </span>

          <div className="relative">
            {formCode === 'MARRIAGE_REGISTRATION' ? (
              <MarriageDocument
                applicationId={applicationId}
                token={token}
                fields={fields}
                data={data}
              />
            ) : (
              <GenericDocument
                applicationId={applicationId}
                token={token}
                procedureName={procedureName}
                fields={fields}
                data={data}
              />
            )}

            <p className="no-pdf mt-8 pt-3 border-t border-slate-300 text-[12px] italic text-slate-600">
              Bản xem trước tạo từ hệ thống demo (biểu mẫu phiên bản {formVersion}) — chỉ mang tính
              tham khảo, không thay thế biểu mẫu chính thức của cơ quan có thẩm quyền.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
