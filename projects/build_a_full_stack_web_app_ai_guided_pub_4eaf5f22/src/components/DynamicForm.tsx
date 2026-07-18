'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROVINCES } from '@/lib/constants';
import { evaluateCondition, runRules, type ValidationErrorItem } from '@/lib/rule-engine';
import type { FieldDef, RuleDef } from '@/lib/schema-guards';

const INPUT_CLASS =
  'w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-lg text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20';

const INPUT_ERROR_CLASS = ' border-red-600 focus:border-red-600 focus:ring-red-600/20';

/** Nhóm field theo id prefix / heuristic UI — không đụng schema backend. */
function getFieldSection(field: FieldDef): { key: string; title: string } {
  const id = field.id.toLowerCase();
  if (id.startsWith('male_') || id.includes('groom')) {
    return { key: 'male', title: 'Thông tin bên nam' };
  }
  if (id.startsWith('female_') || id.includes('bride')) {
    return { key: 'female', title: 'Thông tin bên nữ' };
  }
  if (id.startsWith('child_') || id === 'birth_date') {
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
          <p id={errorId} className="text-base font-medium text-red-700" role="alert">
            {fieldErrors.map((err, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {err.message}
                {err.suggestion ? ' — ' + err.suggestion : ''}
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
            Biểu mẫu có {clientErrors.length} mục cần kiểm tra. Vui lòng xem các thông báo màu đỏ
            bên dưới.
          </p>
          {orphanErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {orphanErrors.map((err, i) => (
                <li key={i}>
                  {err.message}
                  {err.suggestion ? ' — ' + err.suggestion : ''}
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

type MigrationPreview = {
  fromVersion: string;
  toVersion: string;
  migrated: string[];
  needsConfirmation: { from: string; value: unknown; options: string[] }[];
  dropped: string[];
};

type ApplicationFormRunnerProps = {
  applicationId: string;
  fields: FieldDef[];
  rules?: RuleDef[];
  initialData?: Record<string, unknown>;
  revision: number;
  formVersion: string;
  updateAvailable: boolean;
  newVersion?: string;
  token: string;
};

export function ApplicationFormRunner({
  applicationId,
  fields: initialFields,
  rules: initialRules,
  initialData,
  revision: initialRevision,
  formVersion: initialFormVersion,
  updateAvailable: initialUpdateAvailable,
  newVersion: initialNewVersion,
  token,
}: ApplicationFormRunnerProps) {
  const router = useRouter();

  const [fields, setFields] = useState<FieldDef[]>(initialFields);
  const [rules, setRules] = useState<RuleDef[] | undefined>(initialRules);
  const [data, setData] = useState<Record<string, unknown>>(initialData ?? {});
  const [revision, setRevision] = useState<number>(initialRevision);
  const [formVersion, setFormVersion] = useState<string>(initialFormVersion);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(initialUpdateAvailable);
  const [newVersion, setNewVersion] = useState<string | undefined>(initialNewVersion);
  // Bumped on every refetch so DynamicForm remounts and re-reads initialData.
  const [formKey, setFormKey] = useState(0);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
    setFormVersion(typeof body.formVersion === 'string' ? body.formVersion : '');
    setUpdateAvailable(!!body.updateAvailable);
    setNewVersion(typeof body.newVersion === 'string' ? body.newVersion : undefined);
    setFormKey((k) => k + 1);
    return body;
  };

  const handleSubmit = async (
    formData: Record<string, unknown>,
    _clientErrors: ValidationErrorItem[]
  ) => {
    if (saving) {
      return;
    }
    setNotice(null);
    setErrorMsg(null);
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

  return (
    <div className="space-y-5">
      {eco && <span className="badge-eco" />}

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

      <p className="text-base text-slate-500">Phiên bản biểu mẫu: {formVersion}</p>

      <DynamicForm
        key={formKey}
        fields={fields}
        rules={rules}
        initialData={data}
        submitLabel={saving ? 'Đang lưu...' : 'Lưu và kiểm tra hồ sơ'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}