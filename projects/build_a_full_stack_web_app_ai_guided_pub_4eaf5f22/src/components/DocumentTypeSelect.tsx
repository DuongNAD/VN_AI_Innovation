'use client';

import {
  DOCUMENT_TYPES,
  getDocumentTypeMeta,
  type DocumentTypeCode,
} from '@/lib/document-types';

type Props = {
  value: DocumentTypeCode;
  onChange: (next: DocumentTypeCode) => void;
  disabled?: boolean;
  /** compact = single-line select; cards = grid of options */
  variant?: 'select' | 'cards';
  id?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
};

/**
 * Dropdown / card picker for application document classification.
 */
export default function DocumentTypeSelect({
  value,
  onChange,
  disabled = false,
  variant = 'select',
  id = 'document-type',
  label = 'Loại đơn / hồ sơ',
  helpText = 'Chọn đúng loại đơn để cán bộ tiếp nhận phân loại hàng chờ.',
  required = true,
}: Props) {
  const meta = getDocumentTypeMeta(value);

  if (variant === 'cards') {
    return (
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-semibold text-slate-800">
          {label}
          {required ? <span className="text-rose-600"> *</span> : null}
        </legend>
        {helpText ? <p className="text-sm text-slate-500">{helpText}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCUMENT_TYPES.map((t) => {
            const active = t.code === value;
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => onChange(t.code)}
                className={
                  'rounded-xl border px-3 py-3 text-left transition ' +
                  (active
                    ? t.accentClass + ' ring-2 ring-offset-1 ring-slate-400'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')
                }
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg" aria-hidden>
                    {t.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="mt-0.5 block text-xs opacity-80">{t.description}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </label>
      {helpText ? <p className="text-xs text-slate-500">{helpText}</p> : null}
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as DocumentTypeCode)}
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <span
          className={
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-xs font-semibold ' +
            meta.badgeClass
          }
        >
          {meta.icon}
        </span>
      </div>
    </div>
  );
}

export function DocumentTypeBadge({
  code,
  className = '',
}: {
  code: string | null | undefined;
  className?: string;
}) {
  const meta = getDocumentTypeMeta(code);
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ' +
        meta.badgeClass +
        (className ? ' ' + className : '')
      }
      title={meta.description}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
