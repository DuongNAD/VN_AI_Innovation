'use client';

import { PROVINCES } from '@/lib/constants';
import { confidenceLevel, confidencePercent } from '@/lib/confidence';
import type { Question } from './chat-types';
import { safeHttpsUrl } from './chat-utils';

type OptionsProps = {
  question: Question;
  busy: boolean;
  onSelect: (value: string | number | boolean, label: string) => void;
};

export function ChatOptionButtons({ question, busy, onSelect }: OptionsProps) {
  const options = question.options || [];
  return (
    <div className="mx-auto my-4 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={busy}
          onClick={() => onSelect(opt.value, opt.label)}
          className="min-h-[48px] w-full rounded-xl border border-surface-border bg-surface p-4 text-left font-semibold text-slate-900 shadow-sm motion-safe:transition-all motion-safe:duration-200 motion-safe:active:scale-[0.99] hover:border-brand-400 hover:bg-brand-50 hover:shadow-md focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type ProvinceProps = {
  question: Question;
  busy: boolean;
  value: string;
  onChange: (v: string) => void;
  onConfirm: (v: string) => void;
};

export function ChatProvinceSelect({
  question: _question,
  busy,
  value,
  onChange,
  onConfirm,
}: ProvinceProps) {
  return (
    <div className="mx-auto my-4 flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        className="min-h-[48px] w-full flex-1 rounded-xl border border-surface-border bg-surface px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
        aria-label="Chọn tỉnh thành"
      >
        <option value="">-- Chọn Tỉnh/Thành phố --</option>
        {PROVINCES.map((prov) => (
          <option key={prov} value={prov}>
            {prov}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || !value}
        onClick={() => onConfirm(value)}
        className="btn min-h-[48px] w-full rounded-xl bg-accent-500 px-6 py-3 font-bold text-slate-950 transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
      >
        Xác nhận
      </button>
    </div>
  );
}

type ProcedureCardProps = {
  attachment: {
    procedure?: {
      code: string;
      name: string;
      confidence: number;
      sourceUrl?: string;
    };
  };
  busy: boolean;
  onStart: (code: string, name: string) => void;
};

export function ChatProcedureCard({ attachment, busy, onStart }: ProcedureCardProps) {
  const validatedLink = safeHttpsUrl(attachment.procedure?.sourceUrl);
  const score = confidencePercent(attachment.procedure?.confidence);
  const level = confidenceLevel(attachment.procedure?.confidence);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <h4 className="text-base font-bold text-brand-900">{attachment.procedure?.name}</h4>
      <div
        className="flex items-center justify-between gap-4 text-sm text-slate-700"
        title="Điểm khớp giữa nội dung bạn nhập và thủ tục được gợi ý; không phải độ chính xác pháp lý."
      >
        <span>
          Mức độ khớp: <strong className="text-brand-800">{level} · {score}%</strong>
        </span>
        {validatedLink ? (
          <a
            href={validatedLink}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline hover:text-brand-800"
          >
            Nguồn
          </a>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          attachment.procedure && onStart(attachment.procedure.code, attachment.procedure.name)
        }
        className="btn min-h-[44px] w-full rounded-lg bg-accent-500 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        Đúng, bắt đầu thủ tục này
      </button>
    </div>
  );
}

type SupportedProps = {
  attachment: {
    procedures?: { code: string; name: string }[];
    originalMessage?: string;
  };
  busy: boolean;
  onStart: (code: string, originalMessage: string) => void;
};

export function ChatSupportedProcedures({ attachment, busy, onStart }: SupportedProps) {
  return (
    <div className="mt-3 space-y-2">
      {(attachment.procedures || []).map((proc) => (
        <button
          key={proc.code}
          type="button"
          disabled={busy}
          onClick={() => onStart(proc.code, attachment.originalMessage || '')}
          className="min-h-[44px] w-full rounded-lg border border-surface-border bg-surface p-3 text-left text-sm font-semibold text-slate-900 transition-all hover:border-brand-400 hover:bg-brand-50"
        >
          {proc.name}
        </button>
      ))}
    </div>
  );
}
