'use client';

import type { FieldDef } from '@/lib/schema-guards';

type DocumentPreviewProps = {
  procedureName: string;
  formCode: string;
  formVersion: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
};

const DOTS = '………………………………';

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

/** Official-styled marriage declaration (Tờ khai đăng ký kết hôn). */
function MarriageDocument({ fields, data }: { fields: FieldDef[]; data: Record<string, unknown> }) {
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
          {previouslyMarried && has('divorce_document') && (
            <tr>
              <td className="border border-slate-500 px-3 py-2 font-semibold">Trích lục ly hôn kèm theo</td>
              <td className="border border-slate-500 px-3 py-2" colSpan={2}>{val('divorce_document')}</td>
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
function GenericDocument({ procedureName, fields, data }: {
  procedureName: string; fields: FieldDef[]; data: Record<string, unknown>;
}) {
  const rows = fields
    .filter((f) => f.type !== 'file' || !isEmpty(data[f.id]))
    .map((f) => ({ label: f.label, value: fmtValue(f, data[f.id]) }));

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
              <td className="border border-slate-500 px-3 py-2">{row.value}</td>
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
  procedureName,
  formCode,
  formVersion,
  fields,
  data,
}: DocumentPreviewProps) {
  const handleExportPdf = () => {
    window.print();
  };

  return (
    <section aria-label="Xem trước tờ khai" className="space-y-4">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Xem trước tờ khai</h2>
          <p className="text-sm text-slate-500">
            Bản điền sẵn từ thông tin bạn đã khai — kiểm tra lại lần cuối trước khi nộp.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Xuất PDF
        </button>
      </div>

      <div className="print-area">
        <div className="document-sheet relative overflow-hidden bg-white border border-slate-300 rounded-lg shadow-sm px-6 py-8 sm:px-10 font-serif text-slate-900">
          <span
            aria-hidden="true"
            className="document-watermark pointer-events-none select-none absolute inset-0 flex items-center justify-center text-4xl sm:text-5xl font-bold uppercase tracking-widest text-slate-900/[0.06] rotate-[-24deg]"
          >
            Bản xem trước
          </span>

          <div className="relative">
            {formCode === 'MARRIAGE_REGISTRATION' ? (
              <MarriageDocument fields={fields} data={data} />
            ) : (
              <GenericDocument procedureName={procedureName} fields={fields} data={data} />
            )}

            <p className="mt-8 pt-3 border-t border-slate-300 text-[12px] italic text-slate-600">
              Bản xem trước tạo từ hệ thống demo (biểu mẫu phiên bản {formVersion}) — chỉ mang tính
              tham khảo, không thay thế biểu mẫu chính thức của cơ quan có thẩm quyền.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
