import { FieldDef, ConditionDef, RuleDef, isSafeRegex } from './schema-guards';
import { LIMITS } from './constants';

export const MAX_FORM_KEYS = 200;
export const DATA_INTEGRITY_MESSAGE = "Dữ liệu cấu hình không hợp lệ.";
export const DATA_INTEGRITY_SUGGESTION = "Vui lòng liên hệ quản trị viên để kiểm tra lại cấu hình hệ thống.";
export const FALLBACK_MESSAGE = "Dữ liệu nhập vào không hợp lệ.";
export const FALLBACK_SUGGESTION = "Vui lòng kiểm tra và nhập lại thông tin chính xác.";
export const INVALID_DATE_MESSAGE = "Ngày tháng không hợp lệ.";
export const INVALID_DATE_SUGGESTION = "Vui lòng nhập đủ ngày, tháng và năm gồm 4 chữ số (ví dụ: 13/10/2000).";

export type ValidationErrorItem = {
  code: string;
  field?: string;
  fields?: string[];
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
};

export function isEmptyValue(v: unknown): boolean {
  if (v === '' || v === null || v === undefined) {
    return true;
  }
  if (Array.isArray(v) && v.length === 0) {
    return true;
  }
  return false;
}

export function coerceForComparison(v: unknown): unknown {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') {
      return v;
    }
    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return num;
    }
    return v;
  }
  return v;
}

export function evaluateCondition(cond: ConditionDef, data: Record<string, unknown>): boolean {
  if (!cond || !cond.field || !cond.operator) {
    return false;
  }

  const rawVal = cond.field in data ? data[cond.field] : undefined;
  const coercedVal = coerceForComparison(rawVal);
  const operator = cond.operator;

  if (operator === 'is_empty') {
    return isEmptyValue(rawVal);
  }
  if (operator === 'not_empty') {
    return !isEmptyValue(rawVal);
  }

  const rawCondVal = cond.value;
  const coercedCondVal = coerceForComparison(rawCondVal);

  if (operator === 'equals') {
    if (typeof coercedVal === 'number' && Number.isNaN(coercedVal)) return false;
    if (typeof coercedCondVal === 'number' && Number.isNaN(coercedCondVal)) return false;
    return coercedVal === coercedCondVal;
  }
  if (operator === 'not_equals') {
    if (typeof coercedVal === 'number' && Number.isNaN(coercedVal)) return true;
    if (typeof coercedCondVal === 'number' && Number.isNaN(coercedCondVal)) return true;
    return coercedVal !== coercedCondVal;
  }
  if (operator === 'in') {
    if (!Array.isArray(rawCondVal)) {
      return false;
    }
    if (typeof coercedVal === 'number' && Number.isNaN(coercedVal)) {
      return false;
    }
    for (const cand of rawCondVal) {
      const coercedCand = coerceForComparison(cand);
      if (typeof coercedCand === 'number' && Number.isNaN(coercedCand)) {
        continue;
      }
      if (coercedVal === coercedCand) {
        return true;
      }
    }
    return false;
  }
  // schema-guards allows greater_than/less_than on date fields; ISO dates
  // never coerce to numbers, so compare them lexicographically (ISO order is
  // chronological) before falling back to the numeric path.
  const bothIsoDates =
    typeof rawVal === 'string' &&
    typeof rawCondVal === 'string' &&
    isValidIsoDate(rawVal) &&
    isValidIsoDate(rawCondVal);

  if (operator === 'greater_than') {
    if (bothIsoDates) {
      return (rawVal as string) > (rawCondVal as string);
    }
    if (typeof coercedVal !== 'number' || !Number.isFinite(coercedVal)) return false;
    if (typeof coercedCondVal !== 'number' || !Number.isFinite(coercedCondVal)) return false;
    return coercedVal > coercedCondVal;
  }
  if (operator === 'less_than') {
    if (bothIsoDates) {
      return (rawVal as string) < (rawCondVal as string);
    }
    if (typeof coercedVal !== 'number' || !Number.isFinite(coercedVal)) return false;
    if (typeof coercedCondVal !== 'number' || !Number.isFinite(coercedCondVal)) return false;
    return coercedVal < coercedCondVal;
  }

  return false;
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  const parts = s.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Giữ cùng miền năm với schema cấu hình. Các giá trị như "0200" có đủ
  // 4 ký tự nhưng không phải năm dân sự hợp lệ cho các thủ tục trong hệ thống.
  if (year < 1000 || year > 9999) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return true;
  }
  return false;
}

export function todayInVietnam(): string {
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

function isValidPrimitive(v: unknown): boolean {
  if (v === null || v === undefined) {
    return true;
  }
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'boolean';
}

export function sanitizeFormData(
  fields: FieldDef[],
  data: unknown
): { ok: true; sanitized: Record<string, unknown> } | { ok: false; issues: { field: string; code: string }[] } {
  if (!isPlainObject(data)) {
    return { ok: false, issues: [{ field: '_form', code: 'INVALID_FORM_DATA' }] };
  }

  if (Object.keys(data).length > MAX_FORM_KEYS) {
    return { ok: false, issues: [{ field: '_form', code: 'TOO_MANY_FIELDS' }] };
  }

  const fieldsMap = new Map<string, FieldDef>();
  for (const f of fields) {
    fieldsMap.set(f.id, f);
  }

  const issues: { field: string; code: string }[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(data)) {
    const fieldDef = fieldsMap.get(key);
    if (!fieldDef) {
      issues.push({ field: key, code: 'UNKNOWN_FIELD' });
      continue;
    }

    const rawVal = data[key];
    if (!isValidPrimitive(rawVal)) {
      issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
      continue;
    }

    let val = rawVal;
    if (typeof val === 'string') {
      val = val.trim();
    }

    if (isEmptyValue(val)) {
      sanitized[key] = val;
      continue;
    }

    if (fieldDef.type === 'number') {
      if (typeof val === 'number' && Number.isFinite(val)) {
        sanitized[key] = val;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        const num = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(num)) {
          sanitized[key] = num;
        } else {
          issues.push({ field: key, code: 'INVALID_NUMBER' });
        }
      } else {
        issues.push({ field: key, code: 'INVALID_NUMBER' });
      }
      continue;
    }

    const hasBooleanOptions = !!(fieldDef.options && fieldDef.options.some(o => typeof o.value === 'boolean'));
    const isBooleanValued = fieldDef.type === 'checkbox' || hasBooleanOptions;
    if (isBooleanValued) {
      if (typeof val === 'boolean') {
        sanitized[key] = val;
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === 'true') {
          sanitized[key] = true;
        } else if (trimmed === 'false') {
          sanitized[key] = false;
        } else {
          issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
        }
      } else {
        issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
      }
      continue;
    }

    if (fieldDef.type === 'date') {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (isValidIsoDate(trimmed)) {
          sanitized[key] = trimmed;
        } else {
          issues.push({ field: key, code: 'INVALID_DATE' });
        }
      } else {
        issues.push({ field: key, code: 'INVALID_DATE' });
      }
      continue;
    }

    if (fieldDef.type === 'select' || fieldDef.type === 'radio') {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.length > LIMITS.FIELD_VALUE_MAX) {
          issues.push({ field: key, code: 'VALUE_TOO_LONG' });
          continue;
        }
        if (fieldDef.options && fieldDef.options.length > 0) {
          const isMember = fieldDef.options.some(o => o.value === trimmed);
          if (!isMember) {
            issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
            continue;
          }
        }
        sanitized[key] = trimmed;
      } else {
        issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
      }
      continue;
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > LIMITS.FIELD_VALUE_MAX) {
        issues.push({ field: key, code: 'VALUE_TOO_LONG' });
      } else {
        sanitized[key] = trimmed;
      }
    } else {
      issues.push({ field: key, code: 'INVALID_VALUE_TYPE' });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, sanitized };
}

function isFieldVisible(fieldId: string, fieldsMap: Map<string, FieldDef>, data: Record<string, unknown>): boolean {
  const fieldDef = fieldsMap.get(fieldId);
  if (!fieldDef) {
    return false;
  }
  if (!fieldDef.visibleWhen) {
    return true;
  }
  return evaluateCondition(fieldDef.visibleWhen, data);
}

function ageInFullYears(birthDate: string, onDate: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = onDate.split('-').map(Number);
  let age = currentYear - birthYear;
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age--;
  }
  return age;
}

function dateAfterYears(birthDate: string, years: number): string {
  const [year, month, day] = birthDate.split('-').map(Number);
  // Người sinh 29/02 đạt mốc tuổi vào ngày cuối tháng 2 của năm không nhuận.
  const candidate = new Date(Date.UTC(year + years, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) {
    return `${year + years}-02-28`;
  }
  return `${year + years}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatVietnameseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Điều kiện pháp lý cốt lõi không được phụ thuộc vào việc quản trị viên có
 * quên cấu hình rule trong DB hay không. Các kiểm tra này được nhận diện bằng
 * field id chính thức và chạy ở client, lúc nộp, lẫn lúc cán bộ phê duyệt.
 */
function appendMarriageDomainErrors(
  fieldsMap: Map<string, FieldDef>,
  data: Record<string, unknown>,
  errors: ValidationErrorItem[]
): void {
  const today = todayInVietnam();
  const ageChecks = [
    {
      fieldId: 'male_birth_date',
      minAge: 20,
      personLabel: 'Người nam',
      code: 'MARRIAGE_MALE_UNDERAGE',
    },
    {
      fieldId: 'female_birth_date',
      minAge: 18,
      personLabel: 'Người nữ',
      code: 'MARRIAGE_FEMALE_UNDERAGE',
    },
  ] as const;

  for (const check of ageChecks) {
    if (!fieldsMap.has(check.fieldId)) {
      continue;
    }
    const value = data[check.fieldId];
    if (typeof value !== 'string' || !isValidIsoDate(value) || value > today) {
      continue;
    }
    const age = ageInFullYears(value, today);
    if (age < check.minAge) {
      const eligibleDate = dateAfterYears(value, check.minAge);
      errors.push({
        code: check.code,
        field: check.fieldId,
        message: `${check.personLabel} mới ${age} tuổi, chưa đủ tuổi đăng ký kết hôn.`,
        suggestion: `${check.personLabel} phải từ đủ ${check.minAge} tuổi. Có thể đăng ký từ ngày ${formatVietnameseDate(eligibleDate)}.`,
        severity: 'error',
      });
    } else if (age > 120) {
      errors.push({
        code: 'IMPLAUSIBLE_AGE',
        field: check.fieldId,
        message: `Ngày sinh đang cho kết quả ${age} tuổi, có khả năng đã nhập sai.`,
        suggestion: 'Kiểm tra lại ngày sinh trên CCCD hoặc giấy tờ hộ tịch.',
        severity: 'error',
      });
    }
  }

  if (
    fieldsMap.has('male_identity_number') &&
    fieldsMap.has('female_identity_number')
  ) {
    const maleId = data.male_identity_number;
    const femaleId = data.female_identity_number;
    if (
      typeof maleId === 'string' &&
      maleId !== '' &&
      typeof femaleId === 'string' &&
      femaleId !== '' &&
      maleId === femaleId
    ) {
      errors.push({
        code: 'DUPLICATE_PARTY_IDENTITY',
        fields: ['male_identity_number', 'female_identity_number'],
        message: 'Hai người đăng ký kết hôn đang dùng cùng một số CCCD.',
        suggestion: 'Kiểm tra và nhập đúng số CCCD riêng của từng người.',
        severity: 'error',
      });
    }
  }
}

function appendNameFormatErrors(
  fieldsMap: Map<string, FieldDef>,
  data: Record<string, unknown>,
  errors: ValidationErrorItem[]
): void {
  const namePattern = /^[\p{L}\s\-'\.]{2,}$/u;
  const skipList = ['agency', 'company', 'organization', 'document', 'file', 'province', 'district', 'ward', 'username'];
  
  for (const [fieldId, fieldDef] of fieldsMap.entries()) {
    const lowerId = fieldId.toLowerCase();
    if (lowerId.includes('name')) {
      if (skipList.some(skip => lowerId.includes(skip))) {
        continue;
      }
      const value = data[fieldId];
      if (typeof value !== 'string' || value.trim() === '') {
        continue;
      }
      
      if (fieldDef.visibleWhen && !evaluateCondition(fieldDef.visibleWhen, data)) {
        continue;
      }
      
      if (!namePattern.test(value)) {
        errors.push({
          code: 'INVALID_NAME_FORMAT',
          field: fieldId,
          message: 'Họ và tên không hợp lệ (không được chứa chữ số hoặc ký tự đặc biệt).',
          suggestion: 'Vui lòng kiểm tra lại. Tên chỉ được gồm chữ cái, dấu cách, gạch ngang hoặc dấu chấm.',
          severity: 'error',
        });
      }
    }
  }
}

export function runRules(
  fields: FieldDef[],
  rules: RuleDef[],
  data: Record<string, unknown>
): ValidationErrorItem[] {
  const fieldsMap = new Map<string, FieldDef>();
  for (const f of fields) {
    fieldsMap.set(f.id, f);
  }

  const sortedRules = [...rules].sort((a, b) => {
    if (a.orderNumber !== b.orderNumber) {
      return a.orderNumber - b.orderNumber;
    }
    return a.id.localeCompare(b.id);
  });

  const errors: ValidationErrorItem[] = [];
  const KNOWN_RULE_TYPES = new Set([
    'required',
    'regex',
    'date_not_future',
    'date_after',
    'number_range',
    'conditional_required',
    'cross_field_conflict',
    'conditional_document'
  ]);

  for (const rule of sortedRules) {
    let configValid = true;

    if (!KNOWN_RULE_TYPES.has(rule.type)) {
      configValid = false;
    }

    const isFieldScoped = rule.type !== 'cross_field_conflict';
    if (configValid && isFieldScoped) {
      if (!rule.fieldId || typeof rule.fieldId !== 'string' || !fieldsMap.has(rule.fieldId)) {
        configValid = false;
      }
    }

    if (configValid) {
      const params = rule.params;
      if (!params || typeof params !== 'object' || Array.isArray(params)) {
        configValid = false;
      } else {
        if (rule.type === 'regex') {
          const pattern = params.pattern;
          if (typeof pattern !== 'string' || pattern === '' || !isSafeRegex(pattern)) {
            configValid = false;
          }
        } else if (rule.type === 'date_after') {
          const startField = params.startField;
          const endField = params.endField;
          if (
            typeof startField !== 'string' || startField === '' || !fieldsMap.has(startField) ||
            typeof endField !== 'string' || endField === '' || !fieldsMap.has(endField)
          ) {
            configValid = false;
          }
        } else if (rule.type === 'number_range') {
          const min = params.min;
          const max = params.max;
          const hasMin = min !== undefined && min !== null;
          const hasMax = max !== undefined && max !== null;
          if (!hasMin && !hasMax) {
            configValid = false;
          } else {
            if (hasMin && (typeof min !== 'number' || !Number.isFinite(min))) {
              configValid = false;
            }
            if (hasMax && (typeof max !== 'number' || !Number.isFinite(max))) {
              configValid = false;
            }
          }
        } else if (rule.type === 'conditional_required' || rule.type === 'conditional_document') {
          const when = params.when as any;
          if (!when || typeof when !== 'object' || Array.isArray(when)) {
            configValid = false;
          } else {
            const field = when.field;
            const operator = when.operator;
            const KNOWN_OPERATORS = new Set([
              'equals',
              'not_equals',
              'in',
              'greater_than',
              'less_than',
              'is_empty',
              'not_empty'
            ]);
            if (
              typeof field !== 'string' || field === '' || !fieldsMap.has(field) ||
              typeof operator !== 'string' || !KNOWN_OPERATORS.has(operator)
            ) {
              configValid = false;
            } else if (operator === 'in' && !Array.isArray(when.value)) {
              configValid = false;
            }
          }
        } else if (rule.type === 'cross_field_conflict') {
          const fieldsArr = params.fields;
          const ifField = params.ifField;
          const thenField = params.thenField;
          const thenNotEmpty = params.thenNotEmpty;

          if (
            !Array.isArray(fieldsArr) || fieldsArr.length === 0 ||
            fieldsArr.some(f => typeof f !== 'string' || !fieldsMap.has(f))
          ) {
            configValid = false;
          } else if (
            typeof ifField !== 'string' || ifField === '' || !fieldsMap.has(ifField) ||
            typeof thenField !== 'string' || thenField === '' || !fieldsMap.has(thenField)
          ) {
            configValid = false;
          } else if (thenNotEmpty !== false) {
            configValid = false;
          }
        }
      }
    }

    if (!configValid) {
      errors.push({
        code: 'DATA_INTEGRITY',
        severity: 'error',
        field: (rule.fieldId && typeof rule.fieldId === 'string' && fieldsMap.has(rule.fieldId)) ? rule.fieldId : undefined,
        message: DATA_INTEGRITY_MESSAGE,
        suggestion: DATA_INTEGRITY_SUGGESTION
      });
      continue;
    }

    const skipVisibility = [
      'required',
      'regex',
      'date_not_future',
      'date_after',
      'number_range',
      'conditional_required'
    ].includes(rule.type);
    if (skipVisibility) {
      if (!isFieldVisible(rule.fieldId!, fieldsMap, data)) {
        continue;
      }
    }

    const msg = (rule.message && rule.message.trim() !== '') ? rule.message : FALLBACK_MESSAGE;
    const sug = (rule.suggestion && rule.suggestion.trim() !== '') ? rule.suggestion : FALLBACK_SUGGESTION;
    const sev = rule.severity === 'warning' ? 'warning' : 'error';

    if (rule.type === 'required') {
      const hasKey = rule.fieldId! in data;
      const val = data[rule.fieldId!];
      if (!hasKey || isEmptyValue(val)) {
        errors.push({
          code: 'MISSING_REQUIRED',
          field: rule.fieldId,
          message: msg,
          suggestion: sug,
          severity: sev
        });
      }
    } else if (rule.type === 'regex') {
      const val = data[rule.fieldId!];
      if (!isEmptyValue(val)) {
        if (typeof val !== 'string' || val.length > 500) {
          errors.push({
            code: 'INVALID_FORMAT',
            field: rule.fieldId,
            message: msg,
            suggestion: sug,
            severity: sev
          });
        } else {
          try {
            const regex = new RegExp(rule.params.pattern as string);
            if (!regex.test(val)) {
              errors.push({
                code: 'INVALID_FORMAT',
                field: rule.fieldId,
                message: msg,
                suggestion: sug,
                severity: sev
              });
            }
          } catch (err) {
            errors.push({
              code: 'DATA_INTEGRITY',
              field: rule.fieldId,
              message: DATA_INTEGRITY_MESSAGE,
              suggestion: DATA_INTEGRITY_SUGGESTION,
              severity: 'error'
            });
          }
        }
      }
    } else if (rule.type === 'date_not_future') {
      const val = data[rule.fieldId!];
      if (!isEmptyValue(val)) {
        if (typeof val !== 'string') {
          errors.push({
            code: 'INVALID_DATE',
            field: rule.fieldId,
            message: INVALID_DATE_MESSAGE,
            suggestion: INVALID_DATE_SUGGESTION,
            severity: 'error'
          });
        } else {
          const trimmed = val.trim();
          if (!isValidIsoDate(trimmed)) {
            errors.push({
              code: 'INVALID_DATE',
              field: rule.fieldId,
              message: INVALID_DATE_MESSAGE,
              suggestion: INVALID_DATE_SUGGESTION,
              severity: 'error'
            });
          } else if (trimmed > todayInVietnam()) {
            errors.push({
              code: 'DATE_IN_FUTURE',
              field: rule.fieldId,
              message: msg,
              suggestion: sug,
              severity: sev
            });
          }
        }
      }
    } else if (rule.type === 'date_after') {
      const startField = rule.params.startField as string;
      const endField = rule.params.endField as string;
      const startVal = data[startField];
      const endVal = data[endField];

      if (!isEmptyValue(startVal) && !isEmptyValue(endVal)) {
        let startValid = true;
        let endValid = true;

        if (typeof startVal !== 'string') {
          startValid = false;
          errors.push({
            code: 'INVALID_DATE',
            field: startField,
            message: INVALID_DATE_MESSAGE,
            suggestion: INVALID_DATE_SUGGESTION,
            severity: 'error'
          });
        } else {
          const startTrim = startVal.trim();
          if (!isValidIsoDate(startTrim)) {
            startValid = false;
            errors.push({
              code: 'INVALID_DATE',
              field: startField,
              message: INVALID_DATE_MESSAGE,
              suggestion: INVALID_DATE_SUGGESTION,
              severity: 'error'
            });
          }
        }

        if (typeof endVal !== 'string') {
          endValid = false;
          errors.push({
            code: 'INVALID_DATE',
            field: endField,
            message: INVALID_DATE_MESSAGE,
            suggestion: INVALID_DATE_SUGGESTION,
            severity: 'error'
          });
        } else {
          const endTrim = endVal.trim();
          if (!isValidIsoDate(endTrim)) {
            endValid = false;
            errors.push({
              code: 'INVALID_DATE',
              field: endField,
              message: INVALID_DATE_MESSAGE,
              suggestion: INVALID_DATE_SUGGESTION,
              severity: 'error'
            });
          }
        }

        if (startValid && endValid) {
          const startTrim = (startVal as string).trim();
          const endTrim = (endVal as string).trim();
          if (endTrim <= startTrim) {
            errors.push({
              code: 'DATE_ORDER_INVALID',
              field: endField,
              message: msg,
              suggestion: sug,
              severity: sev
            });
          }
        }
      }
    } else if (rule.type === 'number_range') {
      const val = data[rule.fieldId!];
      if (!isEmptyValue(val)) {
        let coerced: number | null = null;
        if (typeof val === 'number' && Number.isFinite(val)) {
          coerced = val;
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          const num = Number(trimmed);
          if (trimmed !== '' && Number.isFinite(num)) {
            coerced = num;
          }
        }

        if (coerced === null) {
          errors.push({
            code: 'INVALID_NUMBER',
            field: rule.fieldId,
            message: msg,
            suggestion: sug,
            severity: 'error'
          });
        } else {
          const min = rule.params.min as number | undefined;
          const max = rule.params.max as number | undefined;
          let outOfRange = false;
          if (min !== undefined && coerced < min) {
            outOfRange = true;
          }
          if (max !== undefined && coerced > max) {
            outOfRange = true;
          }
          if (outOfRange) {
            errors.push({
              code: 'OUT_OF_RANGE',
              field: rule.fieldId,
              message: msg,
              suggestion: sug,
              severity: sev
            });
          }
        }
      }
    } else if (rule.type === 'conditional_required') {
      const when = rule.params.when as ConditionDef;
      if (evaluateCondition(when, data)) {
        const hasKey = rule.fieldId! in data;
        const val = data[rule.fieldId!];
        if (!hasKey || isEmptyValue(val)) {
          errors.push({
            code: 'MISSING_REQUIRED',
            field: rule.fieldId,
            message: msg,
            suggestion: sug,
            severity: sev
          });
        }
      }
    } else if (rule.type === 'cross_field_conflict') {
      const ifField = rule.params.ifField as string;
      const ifValue = rule.params.ifValue;
      const thenField = rule.params.thenField as string;

      const rawIfVal = data[ifField];
      const coercedIfVal = coerceForComparison(rawIfVal);
      const coercedIfValue = coerceForComparison(ifValue);

      let match = false;
      if (typeof coercedIfVal === 'number' && Number.isNaN(coercedIfVal)) {
        match = false;
      } else if (typeof coercedIfValue === 'number' && Number.isNaN(coercedIfValue)) {
        match = false;
      } else {
        match = coercedIfVal === coercedIfValue;
      }

      const thenVal = data[thenField];
      const isThenNotEmpty = !isEmptyValue(thenVal);

      if (match && isThenNotEmpty) {
        errors.push({
          code: 'CONFLICT',
          field: undefined,
          fields: rule.params.fields as string[],
          message: msg,
          suggestion: sug,
          severity: sev
        });
      }
    } else if (rule.type === 'conditional_document') {
      const when = rule.params.when as ConditionDef;
      if (evaluateCondition(when, data)) {
        const hasKey = rule.fieldId! in data;
        const val = data[rule.fieldId!];
        const isValidFilename = hasKey && typeof val === 'string' && val.trim() !== '';
        if (!isValidFilename) {
          errors.push({
            code: 'MISSING_DOCUMENT',
            field: rule.fieldId,
            message: msg,
            suggestion: sug,
            severity: sev
          });
        }
      }
    }
  }

  appendMarriageDomainErrors(fieldsMap, data, errors);
  appendNameFormatErrors(fieldsMap, data, errors);
  return errors;
}
