import { AppError } from './errors';
import { FieldDef, MigrationHint } from './schema-guards';

export type VersionLike = {
  id: string;
  version: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

// Helper: isValidDate
function isValidDate(d: unknown): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// Helper: isValidVersionString
function isValidVersionString(v: string): boolean {
  if (typeof v !== 'string' || v.length === 0) {
    return false;
  }
  const segments = v.split('.');
  if (segments.length === 0) {
    return false;
  }
  for (const seg of segments) {
    if (seg.length === 0) {
      return false;
    }
    for (let i = 0; i < seg.length; i++) {
      const code = seg.charCodeAt(i);
      if (code < 48 || code > 57) { // Only ASCII 0-9
        return false;
      }
    }
  }
  return true;
}

// Helper: isValueCompatible
function isValueCompatible(value: unknown, def: FieldDef): boolean {
  const type = def.type;
  if (type === 'text' || type === 'textarea' || type === 'file' || type === 'province') {
    return typeof value === 'string';
  }
  if (type === 'number') {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return false;
      }
      const num = Number(trimmed);
      return Number.isFinite(num);
    }
    return false;
  }
  if (type === 'date') {
    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }
    if (typeof value === 'string') {
      return !Number.isNaN(Date.parse(value));
    }
    return false;
  }
  if (def.options && Array.isArray(def.options)) {
    const optionValues = def.options.map(opt => opt.value);
    if (type === 'checkbox') {
      if (!Array.isArray(value)) {
        return false;
      }
      return value.every(item => (typeof item === 'string' || typeof item === 'boolean') && optionValues.includes(item));
    } else {
      return (typeof value === 'string' || typeof value === 'boolean') && optionValues.includes(value);
    }
  }
  if (type === 'checkbox' || type === 'radio') {
    return typeof value === 'boolean';
  }
  return true;
}

// Helper: compareVersions
export function compareVersions(a: string, b: string): number {
  if (!isValidVersionString(a) || !isValidVersionString(b)) {
    throw new AppError(400, 'INVALID_VERSION_FORMAT', 'Định dạng phiên bản không hợp lệ.');
  }

  const segmentsA = a.split('.').map(Number);
  const segmentsB = b.split('.').map(Number);

  const maxLen = Math.max(segmentsA.length, segmentsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = segmentsA[i] ?? 0;
    const valB = segmentsB[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

// Helper: selectActiveVersion
export function selectActiveVersion<T extends VersionLike>(versions: T[], at: Date): T | null {
  if (!isValidDate(at)) {
    return null;
  }

  let selected: T | null = null;
  for (const v of versions) {
    if (v.status === 'DRAFT') {
      continue;
    }
    if (v.effectiveFrom === null || !isValidDate(v.effectiveFrom)) {
      continue;
    }
    if (v.effectiveTo !== null && !isValidDate(v.effectiveTo)) {
      continue;
    }

    const fromTime = v.effectiveFrom.getTime();
    const atTime = at.getTime();

    if (fromTime <= atTime && (v.effectiveTo === null || atTime < v.effectiveTo.getTime())) {
      if (selected === null || fromTime > selected.effectiveFrom!.getTime()) {
        selected = v;
      }
    }
  }
  return selected;
}

// Helper: activateVersion
export function activateVersion<T extends VersionLike>(
  versions: T[],
  targetVersion: string,
  now: Date
): { changed: T[]; target: T; closed: T | null } {
  if (!isValidDate(now)) {
    throw new AppError(400, 'INVALID_DATE', 'Ngày kích hoạt không hợp lệ.');
  }

  const target = versions.find(v => v.version === targetVersion);
  if (!target) {
    throw new AppError(400, 'FORM_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản biểu mẫu mục tiêu.');
  }

  if (target.status !== 'DRAFT') {
    throw new AppError(400, 'INVALID_TARGET_VERSION', 'Phiên bản mục tiêu phải ở trạng thái NHÁP (DRAFT).');
  }

  const currentActive = versions.find(v => v.status === 'ACTIVE');
  if (currentActive) {
    if (compareVersions(target.version, currentActive.version) <= 0) {
      throw new AppError(400, 'INVALID_TARGET_VERSION', 'Phiên bản mục tiêu phải mới hơn phiên bản đang hoạt động.');
    }
  }

  const targetCopy: T = {
    ...target,
    status: 'ACTIVE',
    effectiveFrom: new Date(now.getTime()),
    effectiveTo: null,
  };

  const closedCopy: T | null = currentActive
    ? {
        ...currentActive,
        status: 'RETIRED',
        effectiveTo: new Date(now.getTime()),
      }
    : null;

  const changed: T[] = [targetCopy];
  if (closedCopy) {
    changed.push(closedCopy);
  }

  return {
    changed,
    target: targetCopy,
    closed: closedCopy,
  };
}

// Helper: isEmptyValue (reused from rule-engine logic)
function isEmptyValue(v: unknown): boolean {
  if (v === '' || v === null || v === undefined) {
    return true;
  }
  if (Array.isArray(v) && v.length === 0) {
    return true;
  }
  return false;
}

const DANGEROUS_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function validateId(id: string): void {
  if (DANGEROUS_IDS.has(id)) {
    throw new AppError(400, 'INVALID_FIELD_ID', `Dangerous field identifier: ${id}`);
  }
}

// Structural check for safety
function assertStructuralValue(val: unknown): void {
  let nodeCount = 0;

  function check(v: unknown, depth: number): void {
    if (depth > 4) {
      throw new AppError(400, 'INVALID_FIELD_VALUE', 'Value nesting depth exceeds 4');
    }

    nodeCount++;
    if (nodeCount > 1000) {
      throw new AppError(400, 'INVALID_FIELD_VALUE', 'Value node count exceeds 1000');
    }

    if (v === null) {
      return;
    }

    const t = typeof v;
    if (t === 'string') {
      if ((v as string).length > 10000) {
        throw new AppError(400, 'INVALID_FIELD_VALUE', 'String value exceeds 10000 characters');
      }
      return;
    }

    if (t === 'number') {
      if (!Number.isFinite(v)) {
        throw new AppError(400, 'INVALID_FIELD_VALUE', 'Number must be finite');
      }
      return;
    }

    if (t === 'boolean') {
      return;
    }

    if (t === 'object') {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item === undefined) {
            throw new AppError(400, 'INVALID_FIELD_VALUE', 'Undefined is not allowed inside containers');
          }
          check(item, depth + 1);
        }
        return;
      }

      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) {
        throw new AppError(400, 'INVALID_FIELD_VALUE', 'Value must be a plain object');
      }

      if (v instanceof Date || v instanceof Map || v instanceof Set || v instanceof RegExp) {
        throw new AppError(400, 'INVALID_FIELD_VALUE', 'Class instances are not allowed');
      }

      const keys = Object.keys(v as object);
      for (const k of keys) {
        if (DANGEROUS_IDS.has(k)) {
          throw new AppError(400, 'INVALID_FIELD_VALUE', `Dangerous object key: ${k}`);
        }
        const propValue = (v as any)[k];
        if (propValue === undefined) {
          throw new AppError(400, 'INVALID_FIELD_VALUE', 'Undefined is not allowed inside containers');
        }
        check(propValue, depth + 1);
      }
      return;
    }

    throw new AppError(400, 'INVALID_FIELD_VALUE', 'Unsupported value type');
  }

  check(val, 1);
}

// computeMigration
export function computeMigration(
  oldFields: FieldDef[],
  newFields: FieldDef[],
  hints: MigrationHint[],
  data: Record<string, unknown>,
  resolutions?: Record<string, string>
): {
  migratedData: Record<string, unknown>;
  migrated: string[];
  applied: { from: string; to: string }[];
  needsConfirmation: { from: string; value: unknown; options: string[] }[];
  dropped: string[];
} {
  // Validate identifiers
  for (const f of oldFields) {
    validateId(f.id);
  }
  for (const f of newFields) {
    validateId(f.id);
  }
  for (const h of hints) {
    validateId(h.from);
    for (const c of h.candidates) {
      validateId(c);
    }
  }

  // Scan oldFields ids and newFields ids for duplicates
  const oldIds = new Set<string>();
  for (const f of oldFields) {
    if (oldIds.has(f.id)) {
      throw new AppError(
        400,
        'DUPLICATE_FIELD_ID',
        `Trùng lặp mã trường trong biểu mẫu cũ: '${f.id}'.`
      );
    }
    oldIds.add(f.id);
  }

  const newIds = new Set<string>();
  for (const f of newFields) {
    if (newIds.has(f.id)) {
      throw new AppError(
        400,
        'DUPLICATE_FIELD_ID',
        `Trùng lặp mã trường trong biểu mẫu mới: '${f.id}'.`
      );
    }
    newIds.add(f.id);
  }

  const migratedData: Record<string, unknown> = Object.create(null);
  const migrated: string[] = [];
  const applied: { from: string; to: string }[] = [];
  const needsConfirmation: { from: string; value: unknown; options: string[] }[] = [];
  const dropped: string[] = [];

  const newFieldsMap = new Map<string, FieldDef>();
  for (const f of newFields) {
    newFieldsMap.set(f.id, f);
  }

  const hintsMap = new Map<string, MigrationHint>();
  for (const h of hints) {
    if (!hintsMap.has(h.from)) {
      hintsMap.set(h.from, h);
    }
  }

  // Claim tracking: destination id -> source old field id
  const claimed = new Map<string, string>();

  function writeMigrated(destId: string, sourceId: string, val: unknown) {
    if (claimed.has(destId)) {
      const otherSource = claimed.get(destId)!;
      throw new AppError(
        400,
        'MIGRATION_TARGET_CONFLICT',
        `Xung đột chuyển đổi dữ liệu tại trường mục tiêu '${destId}': được yêu cầu ghi bởi cả trường cũ '${otherSource}' và '${sourceId}'.`
      );
    }
    migratedData[destId] = val;
    claimed.set(destId, sourceId);
  }

  for (const oldField of oldFields) {
    const id = oldField.id;
    const hasVal = Object.prototype.hasOwnProperty.call(data, id);
    const value = hasVal ? data[id] : undefined;

    // (a) value empty: skip entirely, the id appears in no output.
    if (!hasVal || isEmptyValue(value)) {
      continue;
    }

    assertStructuralValue(value);

    const newFieldDef = newFieldsMap.get(id);

    // (b) same id present in newFields AND isValueCompatible(value, that def)
    if (newFieldDef && isValueCompatible(value, newFieldDef)) {
      writeMigrated(id, id, value);
      migrated.push(id);
      continue;
    }

    // (c) otherwise, if a hint with from === id exists
    const hint = hintsMap.get(id);
    if (hint) {
      const options = hint.candidates.filter(c => {
        const targetDef = newFieldsMap.get(c);
        return targetDef !== undefined && isValueCompatible(value, targetDef);
      });

      if (options.length === 0) {
        dropped.push(id);
      } else {
        const hasResolution = resolutions && Object.prototype.hasOwnProperty.call(resolutions, id);
        if (hasResolution) {
          const resolvedTarget = resolutions[id];
          if (!options.includes(resolvedTarget)) {
            throw new AppError(
              400,
              'INVALID_RESOLUTION',
              `Lựa chọn chuyển đổi dữ liệu không hợp lệ cho trường '${id}'.`
            );
          }
          const targetDef = newFieldsMap.get(resolvedTarget);
          if (!targetDef || !isValueCompatible(value, targetDef)) {
            throw new AppError(
              400,
              'INVALID_RESOLUTION',
              `Lựa chọn chuyển đổi dữ liệu không hợp lệ cho trường '${id}'.`
            );
          }
          writeMigrated(resolvedTarget, id, value);
          applied.push({ from: id, to: resolvedTarget });
        } else {
          needsConfirmation.push({ from: id, value, options });
        }
      }
    } else {
      // (d) no hint: push id to dropped.
      dropped.push(id);
    }
  }

  return {
    migratedData,
    migrated,
    applied,
    needsConfirmation,
    dropped,
  };
}