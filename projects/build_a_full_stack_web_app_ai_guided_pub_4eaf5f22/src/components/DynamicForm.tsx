'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROVINCES } from '@/lib/constants';
import { evaluateCondition, runRules, type ValidationErrorItem } from '@/lib/rule-engine';
import type { FieldDef, RuleDef } from '@/lib/schema-guards';

const INPUT_CLASS =
  'w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-lg text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20';

const INPUT_ERROR_CLASS = ' border-red-600 focus:border-red-600 focus:ring-red-600/20';

/** NhĂ³m field theo id prefix / heuristic UI â€” khĂ´ng Ä‘á»¥ng schema backend. */
function getFieldSection(field: FieldDef): { key: string; title: string } {
  const id = field.id.toLowerCase();
  if (id.startsWith('male_') || id.includes('groom')) {
    return { key: 'male', title: 'ThĂ´ng tin bĂªn nam' };
  }
  if (id.startsWith('female_') || id.includes('bride')) {
    return { key: 'female', title: 'ThĂ´ng tin bĂªn ná»¯' };
  }
  if (id.startsWith('child_') || id === 'birth_date') {
    return { key: 'child', title: 'ThĂ´ng tin tráº»' };
  }
  if (id.startsWith('requester_') || id === 'relationship') {
    return { key: 'requester', title: 'NgÆ°á»i Ä‘i khai sinh' };
  }
  if (
    id === 'residence' ||
    id === 'permanent_address' ||
    id === 'temporary_address' ||
    id === 'province' ||
    id === 'phone_number'
  ) {
    return { key: 'address', title: 'Äá»‹a chá»‰ & liĂªn há»‡' };
  }
  if (
    id === 'previously_married' ||
    id === 'marriage_number' ||
    id === 'divorce_document'
  ) {
    return { key: 'marriage', title: 'TĂ¬nh tráº¡ng hĂ´n nhĂ¢n' };
  }
  if (id === 'submission_channel') {
    return { key: 'channel', title: 'KĂªnh ná»™p há»“ sÆ¡' };
  }
  return { key: 'general', title: 'ThĂ´ng tin chung' };
}

/** Giá»¯ thá»© tá»± field gá»‘c; gom nhĂ³m khi key section Ä‘á»•i láº§n Ä‘áº§u. */
function groupFieldsInOrder(
  fields: FieldDef[]
): { key: string; title: string; fields: FieldDef[] }[] {
  const groups: { key: string; title: string; fields: FieldDef[] }[] = [];
  const indexByKey = new Map<string, number>();
  for (const field of fields) {
    const sec = getFieldSection(field);
    const existing = indexByKey.get(sec.key);
    if (existing === undefined) {
      indexByKey.set(sec.key, groups.length);
      groups.push({ key: sec.key, title: sec.title, fields: [field] });
    } else {
      groups[existing].fields.push(field);
    }
  }
  return groups;
}

/**
 * Keeps form state in lockstep with visibleWhen conditions: every visible field
 * has a key ('' default, so required rules fire on empty instead of absent) and
 * hidden fields lose their keys. Iterated to a fixpoint because hiding one field
 * can flip another field's condition; the pass cap guarantees termination.
 */
function syncVisibility(fields: FieldDef[], data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(data, f.id)) {
      next[f.id] = data[f.id];
    }
  }
  for (let pass = 0; pass <= fields.length; pass++) {
    let changed = false;
    for (const f of fields) {
      const visible = !f.visibleWhen || evaluateCondition(f.visibleWhen, next);
      const hasKey = Object.prototype.hasOwnProperty.call(next, f.id);
      if (visible && !hasKey) {
        next[f.id] = '';
        changed = true;
      } else if (!visible && hasKey) {
        delete next[f.id];
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return next;
}

function asInputString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

type DynamicFormProps = {
  fields: FieldDef[];
  rules?: RuleDef[];
  initialData?: Record<string, unknown>;
  submitLabel: string;
  onSubmit(data: Record<string, unknown>, clientErrors: ValidationErrorItem[]): void;
};

export default function DynamicForm({
  fields,
  rules,
  initialData,
  submitLabel,
  onSubmit,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    syncVisibility(fields, initialData ?? {})
  );
  const [clientErrors, setClientErrors] = useState<ValidationErrorItem[]>([]);

  const setField = (id: string, value: unknown) => {
    setFormData((prev) => syncVisibility(fields, { ...prev, [id]: value }));
  };

  const visibleFields = fields.filter((f) =>
    Object.prototype.hasOwnProperty.call(formData, f.id)
  );
  const visibleIds = new Set(visibleFields.map((f) => f.id));

  const errorsFor = (id: string): ValidationErrorItem[] =>
    clientErrors.filter(
      (e) => e.field === id || (Array.isArray(e.fields) && e.fields.includes(id))
    );

  const orphanErrors = clientErrors.filter((e) => {
    if (e.field && visibleIds.has(e.field)) {
      return false;
    }
    if (Array.isArray(e.fields) && e.fields.some((id) => visibleIds.has(id))) {
      return false;
    }
    return true;
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = syncVisibility(fields, formData);
    const errs = rules ? runRules(fields, rules, data) : [];
    setClientErrors(errs);
    onSubmit(data, errs);
  };

  const renderInput = (
    field: FieldDef,
    value: unknown,
    hasError: boolean,
    errorId: string
  ) => {
    const inputId = 'field-' + field.id;
    const base = INPUT_CLASS + (hasError ? INPUT_ERROR_CLASS : '');
    const a11y = {
      'aria-invalid': hasError || undefined,
      'aria-required': field.required || undefined,
      'aria-describedby': hasError ? errorId : undefined,
    } as const;

    switch (field.type) {
      case 'text':
        return (
          <input
            id={inputId}
            type="text"
            className={base}
            placeholder={field.placeholder}
            value={asInputString(value)}
            onChange={(e) => setField(field.id, e.target.value)}
            {...a11y}
          />
        );
      case 'textarea':
        return (
          <textarea
            id={inputId}
            rows={3}
            className={base}
            placeholder={field.placeholder}
            value={asInputString(value)}
            onChange={(e) => setField(field.id, e.target.value)}
            {...a11y}
          />
        );
      case 'number':
        return (
          <input
            id={inputId}
            type="number"
            className={base}
            placeholder={field.placeholder}
            value={asInputString(value)}
            onChange={(e) =>
              setField(field.id, e.target.value === '' ? '' : Number(e.target.value))
            }
            {...a11y}
          />
        );
      case 'date':
        return (
          <input
            id={inputId}
            type="date"
            className={base}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setField(field.id, e.target.value)}
            {...a11y}
          />
        );
      case 'select': {
        const options = field.options ?? [];
        return (
          <select
            id={inputId}
            className={base}
            value={asInputString(value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                setField(field.id, '');
                return;
              }
              const match = options.find((o) => String(o.value) === raw);
              setField(field.id, match ? match.value : raw);
            }}
            {...a11y}
          >
            <option value="">-- Chá»n --</option>
            {options.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case 'radio': {
        const options = field.options ?? [];
        return (
          <div
            className="flex flex-wrap gap-3"
            role="radiogroup"
            aria-label={field.label}
            aria-invalid={hasError || undefined}
            aria-required={field.required || undefined}
            aria-describedby={hasError ? errorId : undefined}
          >
            {options.map((o) => {
              const selected = value === o.value;
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setField(field.id, o.value)}
                  className={
                    'btn border-2 ' +
                    (selected
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-surface-border bg-surface text-slate-800 hover:border-brand-500')
                  }
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      }
      case 'checkbox':
        return (
          <input
            id={inputId}
            type="checkbox"
            className="h-6 w-6 rounded border-surface-border text-brand-600 focus:ring-brand-600"
            checked={value === true}
            onChange={(e) => setField(field.id, e.target.checked)}
            {...a11y}
          />
        );
      case 'file':
        return (
          <div>
            <input
              id={inputId}
              type="file"
              className="block w-full text-lg text-slate-800"
              onChange={(e) =>
                setField(
                  field.id,
                  e.target.files && e.target.files[0] ? e.target.files[0].name : ''
                )
              }
              {...a11y}
            />
            {typeof value === 'string' && value !== '' && (
              <p className="mt-1 text-base text-slate-600">Tá»‡p Ä‘Ă£ chá»n: {value}</p>
            )}
          </div>
        );
      case 'province':
        return (
          <select
            id={inputId}
            className={base}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setField(field.id, e.target.value)}
            {...a11y}
          >
            <option value="">-- Chá»n tá»‰nh/thĂ nh phá»‘ --</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  const sections = groupFieldsInOrder(visibleFields);

  const renderFieldBlock = (field: FieldDef) => {
    const value = formData[field.id];
    const fieldErrors = errorsFor(field.id);
    const hasError = fieldErrors.length > 0;
    const inputId = 'field-' + field.id;
    const errorId = 'field-' + field.id + '-error';
    const isRadio = field.type === 'radio';

    return (
      <div key={field.id} className="space-y-2">
        {isRadio ? (
          <div className="mb-1 text-lg font-semibold text-slate-900" id={inputId + '-label'}>
            {field.label}
            {field.required && (
              <>
                <span className="text-red-600" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (báº¯t buá»™c)</span>
              </>
            )}
          </div>
        ) : (
          <label htmlFor={inputId} className="mb-1 block text-lg font-semibold text-slate-900">
            {field.label}
            {field.required && (
              <>
                <span className="text-red-600" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (báº¯t buá»™c)</span>
              </>
            )}
          </label>
        )}
        {renderInput(field, value, hasError, errorId)}
        {hasError && (
          <p id={errorId} className="text-base font-medium text-red-700" role="alert">
            {fieldErrors.map((err, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {err.message}
                {err.suggestion ? ' â€” ' + err.suggestion : ''}
              </span>
            ))}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {clientErrors.length > 0 && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-lg text-red-800"
          role="alert"
        >
          <p>
            Biá»ƒu máº«u cĂ³ {clientErrors.length} má»¥c cáº§n kiá»ƒm tra. Vui lĂ²ng xem cĂ¡c thĂ´ng bĂ¡o mĂ u Ä‘á»
            bĂªn dÆ°á»›i.
          </p>
          {orphanErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {orphanErrors.map((err, i) => (
                <li key={i}>
                  {err.message}
                  {err.suggestion ? ' â€” ' + err.suggestion : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sections.map((section) => (
        <section
          key={section.key}
          className="card-premium space-y-5 border-l-4 border-l-brand-600 pl-5"
          aria-labelledby={`section-${section.key}-title`}
        >
          <h2
            id={`section-${section.key}-title`}
            className="border-b border-surface-border/80 pb-3 text-title text-brand-900"
          >
            {section.title}
          </h2>
          <div className="space-y-5">{section.fields.map(renderFieldBlock)}</div>
        </section>
      ))}

      <button type="submit" className="btn-primary w-full sm:w-auto">
        {submitLabel}
      </button>
    </form>
  );
}


