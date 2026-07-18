'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROVINCES } from '@/lib/constants';
import {
  evaluateCondition,
  isValidIsoDate,
  runRules,
  type ValidationErrorItem,
} from '@/lib/rule-engine';
import type { FieldDef, RuleDef } from '@/lib/schema-guards';
import SpeechButton from '@/components/SpeechButton';

const INPUT_CLASS =
  'w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-lg text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20';

const INPUT_ERROR_CLASS = ' border-red-600 focus:border-red-600 focus:ring-red-600/20';

/** Nhóm field theo id prefix / heuristic UI — không đụng schema backend. */
function getFieldSection(field: FieldDef, hasChildFields: boolean): { key: string; title: string } {
  const id = field.id.toLowerCase();
  if (id.startsWith('male_') || id.includes('groom')) {
    return { key: 'male', title: 'Thông tin bên nam' };
  }
  if (id.startsWith('female_') || id.includes('bride')) {
    return { key: 'female', title: 'Thông tin bên nữ' };
  }
  // "birth_date" chỉ là ngày sinh của trẻ khi form thực sự có các trường child_*
  // (khai sinh); ở các tờ khai khác (tạm trú, căn cước, hộ chiếu) nó là ngày sinh
  // của người khai và thuộc nhóm thông tin chung.
  if (id.startsWith('child_') || (hasChildFields && id === 'birth_date')) {
    return { key: 'child', title: 'Thông tin trẻ' };
  }
  if (id.startsWith('requester_') || id === 'relationship') {
    return { key: 'requester', title: 'Người đi khai sinh' };
  }
  if (
    id === 'residence' ||
    id === 'permanent_address' ||
    id === 'temporary_address' ||
    id === 'province' ||
    id === 'phone_number'
  ) {
    return { key: 'address', title: 'Địa chỉ & liên hệ' };
  }
  if (
    id === 'previously_married' ||
    id === 'marriage_number' ||
    id === 'divorce_document'
  ) {
    return { key: 'marriage', title: 'Tình trạng hôn nhân' };
  }
  if (id === 'submission_channel') {
    return { key: 'channel', title: 'Kênh nộp hồ sơ' };
  }
  return { key: 'general', title: 'Thông tin chung' };
}

/** Giữ thứ tự field gốc; gom nhóm khi key section đổi lần đầu. */
function groupFieldsInOrder(
  fields: FieldDef[]
): { key: string; title: string; fields: FieldDef[] }[] {
  const groups: { key: string; title: string; fields: FieldDef[] }[] = [];
  const indexByKey = new Map<string, number>();
  const hasChildFields = fields.some((f) => f.id.toLowerCase().startsWith('child_'));
  for (const field of fields) {
    const sec = getFieldSection(field, hasChildFields);
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
 * Seeds every visible field with a key ('' default, so required rules fire on
 * empty instead of absent). Values of fields that later become hidden are kept:
 * re-showing the field restores what the user typed, and the rule engine — not
 * the UI — decides whether the combination is contradictory (e.g. "chưa từng
 * kết hôn" while "số lần kết hôn" still holds a value). Iterated to a fixpoint
 * because seeding one field can flip another field's condition; the pass cap
 * guarantees termination.
 */
export function syncVisibility(fields: FieldDef[], data: Record<string, unknown>): Record<string, unknown> {
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
      }
    }
    if (!changed) {
      break;
    }
  }
  return next;
}

export function visibleFieldsFor(fields: FieldDef[], data: Record<string, unknown>): FieldDef[] {
  return fields.filter((f) => !f.visibleWhen || evaluateCondition(f.visibleWhen, data));
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

function formatIsoDateForInput(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatDateDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dateInputToIso(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) {
    return null;
  }
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4);
  const iso = `${year}-${month}-${day}`;
  return isValidIsoDate(iso) ? iso : null;
}

type DateEntryInputProps = {
  id: string;
  className: string;
  value: unknown;
  invalid: boolean;
  required: boolean;
  describedBy?: string;
  onValueChange(value: string): void;
};

function DateEntryInput({
  id,
  className,
  value,
  invalid,
  required,
  describedBy,
  onValueChange,
}: DateEntryInputProps) {
  const [draft, setDraft] = useState(() => formatIsoDateForInput(value));
  const isoValue = typeof value === 'string' && isValidIsoDate(value) ? value : '';

  const updateFromText = (raw: string) => {
    const formatted = formatDateDigits(raw);
    setDraft(formatted);
    const iso = dateInputToIso(formatted);
    // Giữ bản nháp để rule engine báo đúng lỗi nếu ngày đã đủ 8 số nhưng
    // không tồn tại; khi hợp lệ mới chuyển sang chuẩn ISO cho máy chủ.
    onValueChange(iso ?? formatted);
  };

  const updateFromPicker = (iso: string) => {
    setDraft(formatIsoDateForInput(iso));
    onValueChange(iso);
  };

  return (
    <div className="date-entry">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        className={className + ' pr-16'}
        value={draft}
        maxLength={10}
        placeholder="dd/mm/yyyy"
        onChange={(event) => updateFromText(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
      />
      <span className="date-entry__calendar" aria-hidden="true" />
      <input
        type="date"
        className="date-entry__picker"
        min="1000-01-01"
        value={isoValue}
        onChange={(event) => updateFromPicker(event.target.value)}
        aria-label="Chọn ngày trên lịch"
        tabIndex={-1}
      />
    </div>
  );
}

type DynamicFormProps = {
  fields: FieldDef[];
  rules?: RuleDef[];
  initialData?: Record<string, unknown>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit(data: Record<string, unknown>, clientErrors: ValidationErrorItem[]): void;
  onDirtyChange?(dirty: boolean): void;
};

export default function DynamicForm({
  fields,
  rules,
  initialData,
  submitLabel,
  submitting = false,
  onSubmit,
  onDirtyChange,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    syncVisibility(fields, initialData ?? {})
  );
  const [clientErrors, setClientErrors] = useState<ValidationErrorItem[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [resolvedFieldIds, setResolvedFieldIds] = useState<Set<string>>(() => new Set());
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidedErrorIndex, setGuidedErrorIndex] = useState(0);

  const affectedFieldIds = (errors: ValidationErrorItem[]): Set<string> => {
    const ids = new Set<string>();
    for (const error of errors) {
      if (error.field) {
        ids.add(error.field);
      }
      for (const id of error.fields ?? []) {
        ids.add(id);
      }
    }
    return ids;
  };

  const setField = (id: string, value: unknown) => {
    const nextData = syncVisibility(fields, { ...formData, [id]: value });
    setFormData(nextData);

    // Sau lần kiểm tra đầu tiên, phản hồi ngay khi người dân sửa dữ liệu:
    // lỗi biến mất tại chỗ và trường vừa sửa đúng được xác nhận bằng màu xanh.
    if (hasValidated && rules) {
      const nextErrors = runRules(fields, rules, nextData);
      const previousErrorIds = affectedFieldIds(clientErrors);
      const nextErrorIds = affectedFieldIds(nextErrors);

      setResolvedFieldIds((previouslyResolved) => {
        const nextResolved = new Set(previouslyResolved);
        for (const fieldId of previousErrorIds) {
          if (!nextErrorIds.has(fieldId)) {
            nextResolved.add(fieldId);
          }
        }
        for (const fieldId of nextErrorIds) {
          nextResolved.delete(fieldId);
        }
        return nextResolved;
      });
      setClientErrors(nextErrors);
      if (nextErrors.length === 0) {
        setGuideOpen(false);
        setGuidedErrorIndex(0);
      } else if (guidedErrorIndex >= nextErrors.length) {
        setGuidedErrorIndex(0);
      }
    }

    onDirtyChange?.(true);
  };

  const visibleFields = visibleFieldsFor(fields, formData);
  const visibleIds = new Set(visibleFields.map((f) => f.id));

  const labelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      map[f.id] = f.label;
    }
    return map;
  }, [fields]);

  const errorsFor = (id: string): ValidationErrorItem[] =>
    clientErrors.filter(
      (e) => e.field === id || (Array.isArray(e.fields) && e.fields.includes(id))
    );

  /** First visible field an error can be anchored to (cross-field errors pick the first visible member). */
  const anchorFieldId = (err: ValidationErrorItem): string | null => {
    if (err.field && visibleIds.has(err.field)) {
      return err.field;
    }
    if (Array.isArray(err.fields)) {
      const hit = err.fields.find((id) => visibleIds.has(id));
      if (hit) {
        return hit;
      }
    }
    return null;
  };

  const errorLabel = (err: ValidationErrorItem): string => {
    if (err.field) {
      return labelById[err.field] ?? err.field;
    }
    if (Array.isArray(err.fields) && err.fields.length > 0) {
      return err.fields.map((id) => labelById[id] ?? id).join(' + ');
    }
    return 'Lỗi chung';
  };

  const scrollToField = (id: string) => {
    requestAnimationFrame(() => {
      const wrap = document.getElementById('fieldwrap-' + id);
      wrap?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = document.getElementById('field-' + id) as HTMLElement | null;
      input?.focus({ preventScroll: true });
    });
  };

  const openAiGuide = (requestedIndex = 0) => {
    if (clientErrors.length === 0) {
      return;
    }
    const index = Math.max(0, Math.min(requestedIndex, clientErrors.length - 1));
    setGuidedErrorIndex(index);
    setGuideOpen(true);
    const anchor = anchorFieldId(clientErrors[index]);
    if (anchor) {
      scrollToField(anchor);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    const data = syncVisibility(fields, formData);
    const errs = rules ? runRules(fields, rules, data) : [];
    setHasValidated(true);
    setValidationAttempt((attempt) => attempt + 1);
    setResolvedFieldIds(new Set());
    setClientErrors(errs);
    setGuidedErrorIndex(0);
    setGuideOpen(errs.length > 0);
    if (errs.length > 0) {
      // Guide the user straight to the first thing that needs fixing.
      const visAfter = new Set(visibleFieldsFor(fields, data).map((f) => f.id));
      for (const err of errs) {
        const anchor =
          (err.field && visAfter.has(err.field) && err.field) ||
          (Array.isArray(err.fields) ? err.fields.find((id) => visAfter.has(id)) : null);
        if (anchor) {
          scrollToField(anchor);
          break;
        }
      }
    }
    onSubmit(data, errs);
  };

  const safeGuidedErrorIndex =
    clientErrors.length > 0 ? Math.min(guidedErrorIndex, clientErrors.length - 1) : 0;
  const guidedError =
    guideOpen && clientErrors.length > 0 ? clientErrors[safeGuidedErrorIndex] : null;
  const guidedAnchor = guidedError ? anchorFieldId(guidedError) : null;

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
      case 'text': {
        const idLower = field.id.toLowerCase();
        const isIdentity = idLower.includes('identity') || idLower.includes('cccd');
        // 'number' covers phone_number, marriage_number, etc.
        const isNumeric = isIdentity || idLower.includes('phone') || idLower.includes('number');

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          let val = e.target.value;
          if (isIdentity) {
            val = val.replace(/\D/g, '').slice(0, 12);
          }
          setField(field.id, val);
        };

        return (
          <input
            id={inputId}
            type="text"
            className={base}
            placeholder={field.placeholder}
            value={asInputString(value)}
            onChange={handleChange}
            maxLength={isIdentity ? 12 : 500}
            inputMode={isNumeric ? 'numeric' : undefined}
            {...a11y}
          />
        );
      }
      case 'textarea':
        return (
          <textarea
            id={inputId}
            rows={3}
            className={base}
            placeholder={field.placeholder}
            value={asInputString(value)}
            onChange={(e) => setField(field.id, e.target.value)}
            maxLength={500}
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
          <DateEntryInput
            id={inputId}
            className={base}
            value={value}
            invalid={hasError}
            required={!!field.required}
            describedBy={hasError ? errorId : undefined}
            onValueChange={(nextValue) => setField(field.id, nextValue)}
          />
        );
      case 'select': {
        const options = field.options ?? [];
        return (
          <select
            id={inputId}
            className={base}
            {...a11y}
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
            <option value="">-- Chọn --</option>
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
              <p className="mt-1 text-base text-slate-600">Tệp đã chọn: {value}</p>
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
            <option value="">-- Chọn tỉnh/thành phố --</option>
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
    const wasResolved = hasValidated && !hasError && resolvedFieldIds.has(field.id);
    const isGuidedError = !!guidedError && guidedAnchor === field.id;
    const inputId = 'field-' + field.id;
    const errorId = 'field-' + field.id + '-error';
    const isRadio = field.type === 'radio';

    return (
      <div
        key={`${field.id}:${hasError ? validationAttempt : 'stable'}`}
        id={'fieldwrap-' + field.id}
        className={
          'validation-field space-y-2 ' +
          (hasError
            ? 'validation-field--error'
            : wasResolved
              ? 'validation-field--resolved'
              : '')
        }
      >
        {isRadio ? (
          <div className="mb-1 text-lg font-semibold text-slate-900" id={inputId + '-label'}>
            {field.label}
            {field.required && (
              <>
                <span className="text-red-600" aria-hidden="true">
                  {' '}
                  *
                </span>
                <span className="sr-only"> (bắt buộc)</span>
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
                <span className="sr-only"> (bắt buộc)</span>
              </>
            )}
          </label>
        )}
        {renderInput(field, value, hasError, errorId)}
        {hasError && (
          <div id={errorId} className="validation-field__message" role="alert">
            <span className="validation-field__status-icon" aria-hidden="true">!</span>
            <div>
              {fieldErrors.map((err, i) => (
                <div key={i} className={i > 0 ? 'mt-2' : ''}>
                  <p className="font-bold text-red-900">{err.message}</p>
                  {err.suggestion && (
                    <p className="mt-0.5 text-sm font-medium text-red-700">
                      Cách sửa: {err.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {wasResolved && (
          <p className="validation-field__resolved-message" role="status">
            <span className="validation-field__resolved-icon" aria-hidden="true">✓</span>
            Đã sửa đúng
          </p>
        )}
        {isGuidedError && guidedError && (
          <div
            className="ai-field-guide"
            role="region"
            aria-live="polite"
            aria-label="Trợ lý AI giải thích lỗi đang chọn"
          >
            <span className="ai-field-guide__pointer" aria-hidden="true">↑</span>
            <div className="ai-field-guide__header">
              <span className="ai-field-guide__avatar" aria-hidden="true">
                <span>AI</span>
                <i>✦</i>
              </span>
              <div>
                <p className="font-extrabold text-indigo-950">Trợ lý AI đang chỉ vào lỗi này</p>
                <p className="text-xs font-semibold text-indigo-600">
                  Lỗi {safeGuidedErrorIndex + 1} / {clientErrors.length}
                </p>
              </div>
              <button
                type="button"
                className="ai-field-guide__close"
                onClick={() => setGuideOpen(false)}
                aria-label="Đóng hướng dẫn AI"
              >
                ×
              </button>
            </div>

            <div className="ai-field-guide__content">
              <div>
                <p className="ai-field-guide__label">Vì sao sai?</p>
                <p className="mt-1 font-semibold text-slate-900">{guidedError.message}</p>
              </div>
              {guidedError.suggestion && (
                <div className="ai-field-guide__fix">
                  <p className="ai-field-guide__label">Cách xử lý</p>
                  <p className="mt-1 font-medium text-indigo-950">{guidedError.suggestion}</p>
                </div>
              )}
            </div>

            <div className="ai-field-guide__actions">
              {clientErrors.length > 1 && (
                <button
                  type="button"
                  className="ai-field-guide__next"
                  onClick={() =>
                    openAiGuide((safeGuidedErrorIndex + 1) % clientErrors.length)
                  }
                >
                  Lỗi tiếp theo
                  <span aria-hidden="true">→</span>
                </button>
              )}
              <button
                type="button"
                className="ai-field-guide__understood"
                onClick={() => setGuideOpen(false)}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const blockingErrorCount = clientErrors.filter((error) => error.severity === 'error').length;
  const warningCount = clientErrors.length - blockingErrorCount;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {clientErrors.length > 0 && (
        <div
          key={`validation-summary-${validationAttempt}`}
          className={
            'validation-summary ' +
            (blockingErrorCount > 0
              ? 'validation-summary--error'
              : 'validation-summary--warning')
          }
          role={blockingErrorCount > 0 ? 'alert' : 'status'}
          aria-live={blockingErrorCount > 0 ? 'assertive' : 'polite'}
        >
          <div className="flex items-start gap-3">
            <span className="validation-summary__icon" aria-hidden="true">!</span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">
                {blockingErrorCount > 0
                  ? `Còn ${blockingErrorCount} lỗi cần sửa trước khi tiếp tục`
                  : `Có ${warningCount} cảnh báo cần xem lại`}
              </p>
              <p className="mt-1 text-sm font-medium opacity-90">
                Hệ thống đã đưa bạn đến lỗi đầu tiên. Bấm từng mục dưới đây để chuyển nhanh đến chỗ cần sửa.
              </p>
              <button
                type="button"
                className="ai-guide-start"
                onClick={() => openAiGuide(0)}
                aria-pressed={guideOpen}
              >
                <span className="ai-guide-start__spark" aria-hidden="true">✦</span>
                {guideOpen ? 'AI đang hướng dẫn tại trường bên dưới' : 'Nhờ AI chỉ và giải thích từng lỗi'}
                <span aria-hidden="true">↓</span>
              </button>
              <ul className="mt-3 space-y-2">
                {clientErrors.map((err, i) => {
                  const anchor = anchorFieldId(err);
                  const content = (
                    <>
                      <span className="font-bold">{errorLabel(err)}:</span> {err.message}
                    </>
                  );
                  return (
                    <li key={i}>
                      {anchor ? (
                        <button
                          type="button"
                          onClick={() => scrollToField(anchor)}
                          className="validation-summary__link"
                        >
                          <span aria-hidden="true">→</span>
                          <span>{content}</span>
                        </button>
                      ) : (
                        <span className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>
                            {content}
                            {err.suggestion ? ' — ' + err.suggestion : ''}
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {hasValidated && clientErrors.length === 0 && (
        <div className="validation-summary validation-summary--success" role="status" aria-live="polite">
          <span className="validation-summary__icon" aria-hidden="true">✓</span>
          <div>
            <p className="text-lg font-extrabold">Thông tin đã hợp lệ</p>
            <p className="mt-0.5 text-sm font-medium">
              Không phát hiện lỗi trong các thông tin vừa nhập.
            </p>
          </div>
        </div>
      )}

      {sections.map((section) => (
        (() => {
          const sectionErrorCount = section.fields.reduce(
            (count, field) => count + (errorsFor(field.id).length > 0 ? 1 : 0),
            0
          );
          return (
          <section
            key={section.key}
            className={
              'card-premium space-y-5 border-l-4 pl-5 ' +
              (sectionErrorCount > 0
                ? 'validation-section--error border-l-red-500'
                : 'border-l-brand-600')
            }
            aria-labelledby={`section-${section.key}-title`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-surface-border/80 pb-3">
              <h2
                id={`section-${section.key}-title`}
                className="text-title text-brand-900"
              >
                {section.title}
              </h2>
              {sectionErrorCount > 0 && (
                <span className="validation-section__badge" aria-label={`${sectionErrorCount} trường có lỗi`}>
                  {sectionErrorCount} cần sửa
                </span>
              )}
            </div>
            <div className="space-y-5">{section.fields.map(renderFieldBlock)}</div>
          </section>
          );
        })()
      ))}

      <button
        type="submit"
        className="btn-primary w-full gap-2 sm:w-auto"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting && <span className="validation-submit-spinner" aria-hidden="true" />}
        {submitLabel}
      </button>
    </form>
  );
}

type MigrationPreview = {
  fromVersion: string;
  toVersion: string;
  migrated: string[];
  needsConfirmation: { from: string; value: unknown; options: string[] }[];
  dropped: string[];
};

type AiGuide = {
  text: string;
  degraded: boolean;
};

type ApplicationFormRunnerProps = {
  applicationId: string;
  formCode: string;
  fields: FieldDef[];
  rules?: RuleDef[];
  initialData?: Record<string, unknown>;
  revision: number;
  formVersion: string;
  status: string;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | Date | null;
  updateAvailable: boolean;
  newVersion?: string;
  token: string;
  onVersionChange?(version: string): void;
};

export function ApplicationFormRunner({
  applicationId,
  formCode,
  fields: initialFields,
  rules: initialRules,
  initialData,
  revision: initialRevision,
  formVersion: initialFormVersion,
  status: initialStatus,
  reviewNote,
  reviewedBy,
  reviewedAt,
  updateAvailable: initialUpdateAvailable,
  newVersion: initialNewVersion,
  token,
  onVersionChange,
}: ApplicationFormRunnerProps) {
  const router = useRouter();
  // Tracks unsaved edits inside DynamicForm; migration replaces the form with
  // the server's last-saved data, so we warn before silently dropping edits.
  const dirtyRef = useRef(false);

  const [fields, setFields] = useState<FieldDef[]>(initialFields);
  const [rules, setRules] = useState<RuleDef[] | undefined>(initialRules);
  const [data, setData] = useState<Record<string, unknown>>(initialData ?? {});
  const [revision, setRevision] = useState<number>(initialRevision);
  const [formVersion, setFormVersion] = useState<string>(initialFormVersion);
  const [status, setStatus] = useState<string>(initialStatus);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(initialUpdateAvailable);
  const [newVersion, setNewVersion] = useState<string | undefined>(initialNewVersion);
  // Bumped on every refetch so DynamicForm remounts and re-reads initialData.
  const [formKey, setFormKey] = useState(0);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [aiGuide, setAiGuide] = useState<AiGuide | null>(null);
  const [eco, setEco] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [newFieldLabels, setNewFieldLabels] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const oldLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      map[f.id] = f.label;
    }
    return map;
  }, [fields]);

  const labelFor = (id: string): string => newFieldLabels[id] ?? oldLabelById[id] ?? id;

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined || v === '') {
      return '(trống)';
    }
    if (typeof v === 'object') {
      return JSON.stringify(v);
    }
    return String(v);
  };

  const noteAiFlags = (body: any) => {
    if (body && (body.degraded === true || body.aiMode === 'mock')) {
      setEco(true);
    }
  };

  const apiFetch = async (
    path: string,
    init?: { method?: string; body?: string }
  ): Promise<{ res: Response; body: any }> => {
    const res = await fetch(path, {
      method: init?.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: init?.body,
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    noteAiFlags(body);
    return { res, body };
  };

  const refetchApplication = async (): Promise<any | null> => {
    const { res, body } = await apiFetch('/api/v1/applications/' + applicationId);
    if (!res.ok || !body) {
      setErrorMsg(body?.error?.message ?? 'Không tải lại được hồ sơ. Vui lòng thử lại.');
      return null;
    }
    setFields(Array.isArray(body.fields) ? body.fields : []);
    setRules(Array.isArray(body.rules) ? body.rules : undefined);
    setData(body.data && typeof body.data === 'object' ? body.data : {});
    setRevision(typeof body.revision === 'number' ? body.revision : 0);
    if (typeof body.status === 'string') {
      setStatus(body.status);
    }
    setFormVersion(typeof body.formVersion === 'string' ? body.formVersion : '');
    if (typeof body.formVersion === 'string') {
      onVersionChange?.(body.formVersion);
    }
    setUpdateAvailable(!!body.updateAvailable);
    setNewVersion(typeof body.newVersion === 'string' ? body.newVersion : undefined);
    setFormKey((k) => k + 1);
    setBlockedCount(0);
    setAiGuide(null);
    dirtyRef.current = false;
    return body;
  };

  /**
   * Fetches the grounded AI explanation for the current errors. The endpoint
   * only ever sees error CODES (never the citizen's actual data values), so
   * the guidance text is safe to show verbatim.
   */
  const fetchAiGuide = async (formData: Record<string, unknown>) => {
    try {
      const { res, body } = await apiFetch(
        '/api/v1/forms/' + encodeURIComponent(formCode) + '/validate',
        {
          method: 'POST',
          body: JSON.stringify({ formVersion, data: formData, applicationId }),
        }
      );
      if (res.ok && typeof body?.aiExplanation === 'string' && body.aiExplanation.trim() !== '') {
        setAiGuide({ text: body.aiExplanation, degraded: !!body.degraded || body.aiMode === 'mock' });
      }
    } catch {
      // The inline rule messages already carry the legal guidance; the AI
      // paraphrase is a bonus, so a failure here is silently ignored.
    }
  };

  const handleSubmit = async (
    formData: Record<string, unknown>,
    clientErrors: ValidationErrorItem[]
  ) => {
    if (saving) {
      return;
    }
    setNotice(null);
    setErrorMsg(null);
    setAiGuide(null);
    setSaving(true);
    try {
      const { res, body } = await apiFetch('/api/v1/applications/' + applicationId, {
        method: 'PUT',
        body: JSON.stringify({ data: formData, revision }),
      });
      if (res.status === 409 && body?.error?.code === 'CONCURRENT_UPDATE') {
        await refetchApplication();
        setNotice('Dữ liệu đã thay đổi ở nơi khác, đã tải lại phiên bản mới nhất.');
        return;
      }
      if (!res.ok) {
        setErrorMsg(body?.error?.message ?? 'Không lưu được hồ sơ. Vui lòng thử lại.');
        return;
      }
      setRevision(typeof body?.revision === 'number' ? body.revision : revision + 1);
      dirtyRef.current = false;

      // Blocking errors keep the citizen HERE, next to the fields that need
      // fixing — the draft is already saved so nothing is lost. Only a clean
      // form moves on to the review step.
      const blocking = clientErrors.filter((e) => e.severity === 'error');
      setBlockedCount(blocking.length);
      if (blocking.length > 0) {
        void fetchAiGuide(formData);
        return;
      }
      router.push('/user/result?applicationId=' + applicationId);
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async () => {
    if (migrating) {
      return;
    }
    setNotice(null);
    setErrorMsg(null);
    setMigrating(true);
    try {
      // The runner only holds the pinned (old) schema; the new field labels for
      // the resolution radio groups come from the currently active form version.
      const labels: Record<string, string> = {};
      const appResult = await apiFetch('/api/v1/applications/' + applicationId);
      if (appResult.res.ok && typeof appResult.body?.formCode === 'string') {
        try {
          const activeRes = await fetch(
            '/api/v1/forms/' + encodeURIComponent(appResult.body.formCode) + '/active'
          );
          const activeBody: any = await activeRes.json();
          if (activeRes.ok && Array.isArray(activeBody?.fields)) {
            for (const f of activeBody.fields) {
              if (f && typeof f.id === 'string' && typeof f.label === 'string') {
                labels[f.id] = f.label;
              }
            }
          }
        } catch {
          // Fall back to raw field ids as labels.
        }
      }

      const { res, body } = await apiFetch(
        '/api/v1/applications/' + applicationId + '/migrate',
        { method: 'POST', body: JSON.stringify({}) }
      );
      if (!res.ok || !body) {
        setErrorMsg(body?.error?.message ?? 'Không xem được thay đổi. Vui lòng thử lại.');
        return;
      }
      setNewFieldLabels(labels);
      setPreview({
        fromVersion: typeof body.fromVersion === 'string' ? body.fromVersion : formVersion,
        toVersion: typeof body.toVersion === 'string' ? body.toVersion : (newVersion ?? ''),
        migrated: Array.isArray(body.migrated) ? body.migrated : [],
        needsConfirmation: Array.isArray(body.needsConfirmation) ? body.needsConfirmation : [],
        dropped: Array.isArray(body.dropped) ? body.dropped : [],
      });
      // Nothing preselected: the user must choose every resolution explicitly.
      setResolutions({});
    } finally {
      setMigrating(false);
    }
  };

  const confirmMigration = async () => {
    if (!preview || migrating) {
      return;
    }
    if (
      dirtyRef.current &&
      !window.confirm(
        'Bạn có thay đổi chưa lưu trên biểu mẫu. Việc cập nhật phiên bản sẽ dùng dữ liệu đã lưu gần nhất và bỏ qua các thay đổi chưa lưu. Tiếp tục?'
      )
    ) {
      return;
    }
    setNotice(null);
    setErrorMsg(null);
    setMigrating(true);
    try {
      const { res, body } = await apiFetch(
        '/api/v1/applications/' + applicationId + '/migrate',
        { method: 'POST', body: JSON.stringify({ confirm: true, resolutions }) }
      );
      if (!res.ok) {
        setErrorMsg(body?.error?.message ?? 'Không cập nhật được biểu mẫu. Vui lòng thử lại.');
        return;
      }
      setPreview(null);
      setResolutions({});
      setNewFieldLabels({});
      await refetchApplication();
      setNotice('Biểu mẫu đã được cập nhật theo quy định mới.');
    } finally {
      setMigrating(false);
    }
  };

  const allResolved =
    !!preview &&
    preview.needsConfirmation.every((e) => typeof resolutions[e.from] === 'string');

  const formatDateTime = (v: string | Date | null | undefined): string => {
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
  };

  // Submitted/approved applications are frozen: the citizen follows the
  // outcome on the result page instead of editing here.
  if (status === 'SUBMITTED' || status === 'APPROVED') {
    const approved = status === 'APPROVED';
    return (
      <div
        className={
          'card border ' +
          (approved ? 'border-emerald-300 bg-emerald-50' : 'border-blue-300 bg-blue-50')
        }
        role="status"
      >
        <p className={'text-xl font-bold ' + (approved ? 'text-emerald-900' : 'text-blue-900')}>
          {approved
            ? 'Hồ sơ đã được cán bộ phê duyệt'
            : 'Hồ sơ đã nộp và đang chờ cán bộ xét duyệt'}
        </p>
        <p className={'mt-1 text-lg ' + (approved ? 'text-emerald-800' : 'text-blue-800')}>
          {approved
            ? 'Bạn có thể xem kết quả và tờ khai hoàn chỉnh ở trang kết quả.'
            : 'Trong thời gian chờ duyệt, hồ sơ được khóa và không thể chỉnh sửa.'}
        </p>
        <Link
          href={'/user/result?applicationId=' + applicationId}
          className={
            'btn mt-4 inline-block text-white ' +
            (approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-700 hover:bg-blue-800')
          }
        >
          Xem trạng thái hồ sơ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {eco && <span className="badge-eco" />}

      {status === 'RETURNED' && (
        <div className="card border-l-4 border border-amber-300 border-l-amber-500 bg-amber-50" role="alert">
          <p className="text-lg font-bold text-amber-900">
            Cán bộ đã xem hồ sơ và trả lại để bổ sung
          </p>
          {reviewNote && (
            <p className="mt-1 text-lg text-amber-900">
              <span className="font-semibold">Lý do từ cán bộ:</span> {reviewNote}
            </p>
          )}
          <p className="mt-1 text-base text-amber-800">
            {(reviewedBy ? reviewedBy : 'Cán bộ tiếp nhận') +
              (formatDateTime(reviewedAt) ? ' · ' + formatDateTime(reviewedAt) : '')}
            {' — '}sửa các nội dung trên rồi bấm &quot;Lưu và kiểm tra hồ sơ&quot; để nộp lại.
          </p>
        </div>
      )}

      {updateAvailable && !preview && (
        <div className="card border border-amber-300 bg-amber-50">
          <p className="text-lg font-semibold text-amber-900">
            {'Có biểu mẫu phiên bản ' + (newVersion ?? '') + ' theo quy định mới'}
          </p>
          <button
            type="button"
            className="btn mt-3 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            onClick={openPreview}
            disabled={migrating}
          >
            Xem thay đổi
          </button>
        </div>
      )}

      {preview && (
        <div className="card border border-blue-300">
          <h2 className="text-xl font-bold text-slate-900">
            {'Thay đổi từ phiên bản ' + preview.fromVersion + ' lên ' + preview.toVersion}
          </h2>

          {preview.migrated.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-slate-800">Dữ liệu được giữ nguyên</h3>
              <ul className="mt-1 list-inside list-disc text-lg text-slate-700">
                {preview.migrated.map((id) => (
                  <li key={id}>{labelFor(id)}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.dropped.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-slate-800">
                Trường không còn trong biểu mẫu mới
              </h3>
              <ul className="mt-1 list-inside list-disc text-lg text-slate-700">
                {preview.dropped.map((id) => (
                  <li key={id}>{labelFor(id)}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.needsConfirmation.map((entry) => (
            <fieldset key={entry.from} className="mt-4 rounded-lg border border-slate-300 p-4">
              <legend className="px-1 text-lg font-semibold text-slate-900">
                {'Chuyển dữ liệu của trường "' + labelFor(entry.from) + '" sang trường nào?'}
              </legend>
              <p className="text-base text-slate-600">
                Giá trị hiện tại: {formatValue(entry.value)}
              </p>
              <div className="mt-2 space-y-2">
                {entry.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-3 text-lg text-slate-800">
                    <input
                      type="radio"
                      name={'resolution-' + entry.from}
                      className="h-5 w-5"
                      checked={resolutions[entry.from] === opt}
                      onChange={() =>
                        setResolutions((prev) => ({ ...prev, [entry.from]: opt }))
                      }
                    />
                    <span>{labelFor(opt)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50"
              onClick={confirmMigration}
              disabled={migrating || !allResolved}
            >
              Xác nhận cập nhật
            </button>
            <button
              type="button"
              className="btn border border-surface-border bg-surface text-slate-700"
              onClick={() => {
                setPreview(null);
                setResolutions({});
              }}
              disabled={migrating}
            >
              Để sau
            </button>
          </div>
          {!allResolved && preview.needsConfirmation.length > 0 && (
            <p className="mt-2 text-base text-slate-600">
              Vui lòng chọn nơi chuyển dữ liệu cho từng trường trước khi xác nhận.
            </p>
          )}
        </div>
      )}

      {notice && (
        <div className="card border border-emerald-300 bg-emerald-50 text-lg text-emerald-900" role="status">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="card border border-red-300 bg-red-50 text-lg text-red-800" role="alert">
          {errorMsg}
        </div>
      )}

      {blockedCount > 0 && (
        <div className="card border-l-4 border border-red-300 border-l-red-500 bg-red-50" role="alert">
          <p className="text-lg font-bold text-red-900">
            {'Đã lưu bản nháp — còn ' + blockedCount + ' lỗi cần sửa trước khi tiếp tục'}
          </p>
          <p className="mt-1 text-base text-red-800">
            Hồ sơ chỉ chuyển sang bước Kiểm tra khi không còn lỗi. Các trường cần sửa được đánh
            dấu đỏ bên dưới, kèm hướng dẫn khắc phục cho từng trường.
          </p>
        </div>
      )}

      {aiGuide && blockedCount > 0 && (
        <div className="card border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-950">
              Trợ lý AI giải thích lỗi
            </h3>
            {(aiGuide.degraded || eco) && <span className="badge-eco" aria-label="Chế độ tiết kiệm" />}
          </div>
          <p className="mt-2 whitespace-pre-line text-lg leading-relaxed text-indigo-900">
            {aiGuide.text}
          </p>
          <div className="mt-3 flex flex-col gap-2 border-t border-indigo-100/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-slate-500">
              AI chỉ giải thích mã lỗi — nội dung pháp lý lấy từ cơ sở dữ liệu
            </span>
            <SpeechButton text={aiGuide.text} label="Nghe giải thích từ AI" />
          </div>
        </div>
      )}

      <p className="text-base text-slate-500">Phiên bản biểu mẫu: {formVersion}</p>

      <DynamicForm
        key={formKey}
        fields={fields}
        rules={rules}
        initialData={data}
        submitLabel={saving ? 'Đang lưu...' : 'Lưu và kiểm tra hồ sơ'}
        submitting={saving}
        onSubmit={handleSubmit}
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
        }}
      />
    </div>
  );
}
