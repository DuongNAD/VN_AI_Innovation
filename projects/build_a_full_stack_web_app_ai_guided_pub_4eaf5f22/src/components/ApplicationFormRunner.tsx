'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldDef, RuleDef } from '@/lib/schema-guards';
import type { ValidationErrorItem } from '@/lib/rule-engine';
import DynamicForm from '@/components/DynamicForm';

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
      return '(trá»‘ng)';
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
      setErrorMsg(body?.error?.message ?? 'KhĂ´ng táº£i láº¡i Ä‘Æ°á»£c há»“ sÆ¡. Vui lĂ²ng thá»­ láº¡i.');
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
        setNotice('Dá»¯ liá»‡u Ä‘Ă£ thay Ä‘á»•i á»Ÿ nÆ¡i khĂ¡c, Ä‘Ă£ táº£i láº¡i phiĂªn báº£n má»›i nháº¥t.');
        return;
      }
      if (!res.ok) {
        setErrorMsg(body?.error?.message ?? 'KhĂ´ng lÆ°u Ä‘Æ°á»£c há»“ sÆ¡. Vui lĂ²ng thá»­ láº¡i.');
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
        setErrorMsg(body?.error?.message ?? 'KhĂ´ng xem Ä‘Æ°á»£c thay Ä‘á»•i. Vui lĂ²ng thá»­ láº¡i.');
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
        setErrorMsg(body?.error?.message ?? 'KhĂ´ng cáº­p nháº­t Ä‘Æ°á»£c biá»ƒu máº«u. Vui lĂ²ng thá»­ láº¡i.');
        return;
      }
      setPreview(null);
      setResolutions({});
      setNewFieldLabels({});
      await refetchApplication();
      setNotice('Biá»ƒu máº«u Ä‘Ă£ Ä‘Æ°á»£c cáº­p nháº­t theo quy Ä‘á»‹nh má»›i.');
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
            {'CĂ³ biá»ƒu máº«u phiĂªn báº£n ' + (newVersion ?? '') + ' theo quy Ä‘á»‹nh má»›i'}
          </p>
          <button
            type="button"
            className="btn mt-3 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            onClick={openPreview}
            disabled={migrating}
          >
            Xem thay Ä‘á»•i
          </button>
        </div>
      )}

      {preview && (
        <div className="card border border-blue-300">
          <h2 className="text-xl font-bold text-slate-900">
            {'Thay Ä‘á»•i tá»« phiĂªn báº£n ' + preview.fromVersion + ' lĂªn ' + preview.toVersion}
          </h2>

          {preview.migrated.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-slate-800">Dá»¯ liá»‡u Ä‘Æ°á»£c giá»¯ nguyĂªn</h3>
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
                TrÆ°á»ng khĂ´ng cĂ²n trong biá»ƒu máº«u má»›i
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
                {'Chuyá»ƒn dá»¯ liá»‡u cá»§a trÆ°á»ng "' + labelFor(entry.from) + '" sang trÆ°á»ng nĂ o?'}
              </legend>
              <p className="text-base text-slate-600">
                GiĂ¡ trá»‹ hiá»‡n táº¡i: {formatValue(entry.value)}
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
              XĂ¡c nháº­n cáº­p nháº­t
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
              Äá»ƒ sau
            </button>
          </div>
          {!allResolved && preview.needsConfirmation.length > 0 && (
            <p className="mt-2 text-base text-slate-600">
              Vui lĂ²ng chá»n nÆ¡i chuyá»ƒn dá»¯ liá»‡u cho tá»«ng trÆ°á»ng trÆ°á»›c khi xĂ¡c nháº­n.
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

      <p className="text-base text-slate-500">PhiĂªn báº£n biá»ƒu máº«u: {formVersion}</p>

      <DynamicForm
        key={formKey}
        fields={fields}
        rules={rules}
        initialData={data}
        submitLabel={saving ? 'Äang lÆ°u...' : 'LÆ°u vĂ  kiá»ƒm tra há»“ sÆ¡'}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
