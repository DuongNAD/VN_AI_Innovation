import { AppError } from './errors';
import safeRegex2 from 'safe-regex2';

export type FieldDef = {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'province';
  label: string;
  required?: boolean;
  options?: { value: string | boolean; label: string }[];
  visibleWhen?: ConditionDef;
  placeholder?: string;
};

export type ConditionDef = {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'greater_than' | 'less_than' | 'is_empty' | 'not_empty';
  value?: unknown;
};

export type RuleDef = {
  id: string;
  type: 'required' | 'regex' | 'date_not_future' | 'date_after' | 'number_range' | 'conditional_required' | 'cross_field_conflict' | 'conditional_document';
  fieldId?: string;
  params: Record<string, unknown>;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
  orderNumber: number;
};

export type MigrationHint = {
  from: string;
  candidates: string[];
};

const MAX_FIELDS = 100;
const MAX_RULES = 200;
const MAX_OPTIONS = 50;
const MAX_IN_VALUES = 50;
const MAX_HINTS = 100;
const MAX_CANDIDATES = 20;
const MAX_LABEL = 200;
const MAX_PLACEHOLDER = 200;
const MAX_MESSAGE = 500;
const MAX_VALUE_STRING = 200;
const MAX_PATTERN = 200;
const MAX_URL = 2048;
const ORDER_MIN = 0;
const ORDER_MAX = 9999;
const MAX_SERIALIZED = 262144;

function fail(reason: string): never {
  throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', { reason });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return false;
  }
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function checkBoundedString(v: unknown, maxLen: number, name: string, context?: string): string {
  if (typeof v !== 'string') {
    fail(`${name}_not_string${context ? `:${context}` : ''}`);
  }
  const trimmed = v.trim();
  if (trimmed.length < 1) {
    fail(`${name}_empty${context ? `:${context}` : ''}`);
  }
  if (v.length > maxLen) {
    fail(`${name}_too_long${context ? `:${context}` : ''}`);
  }
  return v;
}

const SLUG_REGEX = /^[a-z][a-z0-9_]{0,49}$/;
function checkSlug(v: unknown, name: string, context?: string): string {
  if (typeof v !== 'string' || !SLUG_REGEX.test(v)) {
    fail(`${name}_invalid_slug${context ? `:${context}` : ''}`);
  }
  return v;
}

function assertConfigSize(raw: unknown): void {
  try {
    const serialized = JSON.stringify(raw);
    if (serialized === undefined) {
      fail('config_undefined');
    }
    if (serialized.length > MAX_SERIALIZED) {
      fail('config_too_large');
    }
  } catch (err) {
    fail('config_circular_or_invalid_json');
  }
}

function isValidDateString(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const parts = s.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function validateCondition(raw: unknown, fieldById: Map<string, FieldDef>, forbidField?: string): ConditionDef {
  if (!isPlainObject(raw)) {
    fail('condition_not_object');
  }

  const keys = Object.keys(raw);
  const allowedKeys = ['field', 'operator', 'value'];
  for (const k of keys) {
    if (!allowedKeys.includes(k)) {
      fail(`condition_unknown_key:${k}`);
    }
  }

  const { field, operator, value } = raw as { field?: unknown; operator?: unknown; value?: unknown };

  if (typeof field !== 'string') {
    fail('condition_field_not_string');
  }
  if (forbidField && field === forbidField) {
    fail(`condition_field_forbidden_self_reference:${field}`);
  }
  const refField = fieldById.get(field);
  if (!refField) {
    fail(`condition_field_not_found:${field}`);
  }

  const operators = ['equals', 'not_equals', 'in', 'greater_than', 'less_than', 'is_empty', 'not_empty'];
  if (typeof operator !== 'string' || !operators.includes(operator)) {
    fail(`condition_invalid_operator:${operator}`);
  }

  if (refField.type === 'file') {
    if (operator !== 'is_empty' && operator !== 'not_empty') {
      fail(`condition_file_field_only_supports_empty_checks:${field}`);
    }
  }

  if (operator === 'is_empty' || operator === 'not_empty') {
    if (value !== undefined) {
      fail(`condition_value_must_be_undefined_for_empty_checks:${field}`);
    }
    return { field, operator };
  }

  const validateValueDomain = (val: unknown) => {
    switch (refField.type) {
      case 'text':
      case 'textarea':
      case 'province':
        if (typeof val !== 'string') {
          fail(`condition_value_must_be_string:${field}`);
        }
        if (val.length < 1 || val.length > MAX_VALUE_STRING) {
          fail(`condition_value_string_length_out_of_bounds:${field}`);
        }
        break;
      case 'number':
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          fail(`condition_value_must_be_finite_number:${field}`);
        }
        break;
      case 'checkbox':
        if (typeof val !== 'boolean') {
          fail(`condition_value_must_be_boolean:${field}`);
        }
        break;
      case 'select':
      case 'radio':
        if (!refField.options) {
          fail(`condition_referenced_field_missing_options:${field}`);
        }
        const hasOption = refField.options.some(opt => opt.value === val);
        if (!hasOption) {
          fail(`condition_value_must_equal_an_option_value:${field}`);
        }
        break;
      case 'date':
        if (typeof val !== 'string' || !isValidDateString(val)) {
          fail(`condition_value_must_be_valid_date_string:${field}`);
        }
        break;
      default:
        fail(`condition_unsupported_field_type_for_value:${field}`);
    }
  };

  if (operator === 'equals' || operator === 'not_equals') {
    if (value === undefined) {
      fail(`condition_value_required:${field}`);
    }
    validateValueDomain(value);
  } else if (operator === 'in') {
    if (!Array.isArray(value)) {
      fail(`condition_in_value_must_be_array:${field}`);
    }
    if (value.length < 1 || value.length > MAX_IN_VALUES) {
      fail(`condition_in_value_array_length_out_of_bounds:${field}`);
    }
    for (const item of value) {
      validateValueDomain(item);
    }
  } else if (operator === 'greater_than' || operator === 'less_than') {
    if (refField.type !== 'number' && refField.type !== 'date') {
      fail(`condition_operator_requires_number_or_date:${field}`);
    }
    if (value === undefined) {
      fail(`condition_value_required:${field}`);
    }
    validateValueDomain(value);
  }

  return { field, operator: operator as ConditionDef['operator'], value };
}

export function isSafeRegex(pattern: string): boolean {
  if (typeof pattern !== 'string') {
    return false;
  }
  if (pattern.length > 200) {
    return false;
  }
  try {
    new RegExp(pattern);
  } catch (err) {
    return false;
  }
  try {
    return safeRegex2(pattern);
  } catch (err) {
    return false;
  }
}

export function parseFieldDefs(raw: unknown): FieldDef[] {
  assertConfigSize(raw);

  if (!Array.isArray(raw)) {
    fail('fields_not_array');
  }
  if (raw.length > MAX_FIELDS) {
    fail('fields_length_out_of_bounds');
  }

  const fields: FieldDef[] = [];
  const fieldById = new Map<string, FieldDef>();
  const idSet = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) {
      fail(`field_not_object:${i}`);
    }

    const keys = Object.keys(item);
    const allowedKeys = ['id', 'type', 'label', 'required', 'options', 'visibleWhen', 'placeholder'];
    for (const k of keys) {
      if (!allowedKeys.includes(k)) {
        fail(`field_unknown_key:${i}:${k}`);
      }
    }

    const { id, type, label, required, options, placeholder } = item as Record<string, unknown>;

    checkSlug(id, 'field_id', String(i));
    const idStr = id as string;
    if (idSet.has(idStr)) {
      fail(`field_duplicate_id:${idStr}`);
    }
    idSet.add(idStr);

    const validTypes = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'province'];
    if (typeof type !== 'string' || !validTypes.includes(type)) {
      fail(`field_invalid_type:${idStr}`);
    }
    const typeStr = type as FieldDef['type'];

    checkBoundedString(label, MAX_LABEL, 'field_label', idStr);
    const labelStr = label as string;

    let requiredBool: boolean | undefined = undefined;
    if (required !== undefined) {
      if (typeof required !== 'boolean') {
        fail(`field_required_not_boolean:${idStr}`);
      }
      requiredBool = required;
    }

    let placeholderStr: string | undefined = undefined;
    if (placeholder !== undefined) {
      checkBoundedString(placeholder, MAX_PLACEHOLDER, 'field_placeholder', idStr);
      placeholderStr = placeholder as string;
    }

    let parsedOptions: { value: string | boolean; label: string }[] | undefined = undefined;
    const isSelectOrRadio = typeStr === 'select' || typeStr === 'radio';
    if (isSelectOrRadio) {
      if (!Array.isArray(options)) {
        fail(`field_options_missing_or_not_array:${idStr}`);
      }
      if (options.length < 1 || options.length > MAX_OPTIONS) {
        fail(`field_options_length_out_of_bounds:${idStr}`);
      }
      const optionValuesSeen = new Set<string | boolean>();
      parsedOptions = [];
      for (let j = 0; j < options.length; j++) {
        const opt = options[j];
        if (!isPlainObject(opt)) {
          fail(`field_option_not_object:${idStr}:${j}`);
        }
        const optKeys = Object.keys(opt);
        if (optKeys.length !== 2 || !optKeys.includes('value') || !optKeys.includes('label')) {
          fail(`field_option_invalid_keys:${idStr}:${j}`);
        }
        const { value: val, label: lbl } = opt as { value?: unknown; label?: unknown };
        if (typeof val !== 'string' && typeof val !== 'boolean') {
          fail(`field_option_value_invalid_type:${idStr}:${j}`);
        }
        if (typeof val === 'string') {
          if (val.length < 1 || val.length > MAX_VALUE_STRING) {
            fail(`field_option_value_string_length_out_of_bounds:${idStr}:${j}`);
          }
        }
        checkBoundedString(lbl, MAX_LABEL, 'field_option_label', `${idStr}:${j}`);

        if (optionValuesSeen.has(val)) {
          fail(`field_option_value_duplicate:${idStr}`);
        }
        optionValuesSeen.add(val);

        parsedOptions.push({ value: val, label: lbl as string });
      }
    } else {
      if (options !== undefined) {
        fail(`field_options_forbidden_for_type:${idStr}:${typeStr}`);
      }
    }

    const fieldDef: FieldDef = {
      id: idStr,
      type: typeStr,
      label: labelStr,
    };
    if (requiredBool !== undefined) fieldDef.required = requiredBool;
    if (parsedOptions !== undefined) fieldDef.options = parsedOptions;
    if (placeholderStr !== undefined) fieldDef.placeholder = placeholderStr;

    fields.push(fieldDef);
    fieldById.set(idStr, fieldDef);
  }

  for (let i = 0; i < raw.length; i++) {
    const rawField = raw[i] as any;
    if (rawField.visibleWhen !== undefined) {
      const fieldDef = fields[i];
      fieldDef.visibleWhen = validateCondition(rawField.visibleWhen, fieldById, fieldDef.id);
    }
  }

  return fields;
}

export function parseRuleDefs(raw: unknown, fields: FieldDef[]): RuleDef[] {
  assertConfigSize(raw);

  if (!Array.isArray(raw)) {
    fail('rules_not_array');
  }
  if (raw.length > MAX_RULES) {
    fail('rules_length_out_of_bounds');
  }

  const fieldById = new Map<string, FieldDef>(fields.map(f => [f.id, f]));
  const ruleIds = new Set<string>();
  const rules: RuleDef[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) {
      fail(`rule_not_object:${i}`);
    }

    const keys = Object.keys(item);
    const allowedKeys = ['id', 'type', 'fieldId', 'params', 'message', 'suggestion', 'severity', 'orderNumber'];
    for (const k of keys) {
      if (!allowedKeys.includes(k)) {
        fail(`rule_unknown_key:${i}:${k}`);
      }
    }

    const { id, type, fieldId, params, message, suggestion, severity, orderNumber } = item as Record<string, unknown>;

    checkSlug(id, 'rule_id', String(i));
    const idStr = id as string;
    if (ruleIds.has(idStr)) {
      fail(`rule_duplicate_id:${idStr}`);
    }
    ruleIds.add(idStr);

    const validRuleTypes = [
      'required',
      'regex',
      'date_not_future',
      'date_after',
      'number_range',
      'conditional_required',
      'cross_field_conflict',
      'conditional_document',
    ];
    if (typeof type !== 'string' || !validRuleTypes.includes(type)) {
      fail(`rule_invalid_type:${idStr}`);
    }
    const typeStr = type as RuleDef['type'];

    let fieldIdStr: string | undefined = undefined;
    if (typeStr === 'cross_field_conflict') {
      if (fieldId !== undefined) {
        fail(`rule_fieldId_must_be_absent_for_cross_field_conflict:${idStr}`);
      }
    } else {
      if (fieldId === undefined) {
        fail(`rule_fieldId_required:${idStr}`);
      }
      if (typeof fieldId !== 'string') {
        fail(`rule_fieldId_not_string:${idStr}`);
      }
      fieldIdStr = fieldId;
      const refField = fieldById.get(fieldIdStr);
      if (!refField) {
        fail(`rule_fieldId_not_found:${idStr}:${fieldIdStr}`);
      }

      switch (typeStr) {
        case 'regex':
          if (refField.type !== 'text' && refField.type !== 'textarea') {
            fail(`rule_regex_incompatible_field:${idStr}:${refField.type}`);
          }
          break;
        case 'date_not_future':
        case 'date_after':
          if (refField.type !== 'date') {
            fail(`rule_date_rules_require_date_field:${idStr}:${refField.type}`);
          }
          break;
        case 'number_range':
          if (refField.type !== 'number') {
            fail(`rule_number_range_requires_number_field:${idStr}:${refField.type}`);
          }
          break;
        case 'conditional_document':
          if (refField.type !== 'file') {
            fail(`rule_conditional_document_requires_file_field:${idStr}:${refField.type}`);
          }
          break;
        case 'required':
        case 'conditional_required':
          break;
      }
    }

    if (!isPlainObject(params)) {
      fail(`rule_params_not_object:${idStr}`);
    }
    const paramsObj = params as Record<string, unknown>;
    // Params are validated in their canonical stored shape below, then
    // normalized to the exact shape the rule engine consumes at runtime.
    let engineParams: Record<string, unknown> = paramsObj;

    switch (typeStr) {
      case 'required':
      case 'date_not_future':
        if (Object.keys(paramsObj).length !== 0) {
          fail(`rule_params_must_be_empty:${idStr}`);
        }
        break;

      case 'regex': {
        const pKeys = Object.keys(paramsObj);
        if (pKeys.length !== 1 || pKeys[0] !== 'pattern') {
          fail(`rule_regex_params_must_only_have_pattern:${idStr}`);
        }
        const pattern = paramsObj.pattern;
        if (typeof pattern !== 'string') {
          fail(`rule_regex_pattern_not_string:${idStr}`);
        }
        if (!isSafeRegex(pattern)) {
          fail(`rule_regex_unsafe_pattern:${idStr}`);
        }
        break;
      }

      case 'date_after': {
        // Two accepted dialects — authoring {afterFieldId} and the stored
        // engine dialect {startField, endField}; both normalize to the latter.
        const keySig = Object.keys(paramsObj).sort().join(',');
        let afterFieldId: unknown;
        if (keySig === 'afterFieldId') {
          afterFieldId = paramsObj.afterFieldId;
        } else if (keySig === 'endField,startField') {
          if (paramsObj.endField !== fieldIdStr) {
            fail(`rule_date_after_endField_must_match_fieldId:${idStr}`);
          }
          afterFieldId = paramsObj.startField;
        } else {
          fail(`rule_date_after_params_must_only_have_afterFieldId:${idStr}`);
        }
        if (typeof afterFieldId !== 'string') {
          fail(`rule_date_after_afterFieldId_not_string:${idStr}`);
        }
        const afterField = fieldById.get(afterFieldId);
        if (!afterField) {
          fail(`rule_date_after_afterFieldId_not_found:${idStr}:${afterFieldId}`);
        }
        if (afterField.type !== 'date') {
          fail(`rule_date_after_afterField_not_date_field:${idStr}:${afterFieldId}`);
        }
        if (afterFieldId === fieldIdStr) {
          fail(`rule_date_after_self_reference_forbidden:${idStr}`);
        }
        engineParams = { startField: afterFieldId, endField: fieldIdStr };
        break;
      }

      case 'number_range': {
        const pKeys = Object.keys(paramsObj);
        if (pKeys.length === 0) {
          fail(`rule_number_range_params_cannot_be_empty:${idStr}`);
        }
        for (const k of pKeys) {
          if (k !== 'min' && k !== 'max') {
            fail(`rule_number_range_unknown_param:${idStr}:${k}`);
          }
        }
        const min = paramsObj.min;
        const max = paramsObj.max;
        if (min !== undefined) {
          if (typeof min !== 'number' || !Number.isFinite(min)) {
            fail(`rule_number_range_min_not_finite_number:${idStr}`);
          }
        }
        if (max !== undefined) {
          if (typeof max !== 'number' || !Number.isFinite(max)) {
            fail(`rule_number_range_max_not_finite_number:${idStr}`);
          }
        }
        if (min !== undefined && max !== undefined) {
          if (min > max) {
            fail(`rule_number_range_min_greater_than_max:${idStr}`);
          }
        }
        break;
      }

      case 'conditional_required': {
        const pKeys = Object.keys(paramsObj);
        if (pKeys.length !== 1 || (pKeys[0] !== 'condition' && pKeys[0] !== 'when')) {
          fail(`rule_conditional_required_params_must_only_have_condition:${idStr}`);
        }
        const cond = pKeys[0] === 'condition' ? paramsObj.condition : paramsObj.when;
        validateCondition(cond, fieldById, fieldIdStr);
        engineParams = { when: cond };
        break;
      }

      case 'cross_field_conflict': {
        // Two accepted dialects: authoring {conditions:[equals, not_empty]}
        // and the stored engine dialect {fields, ifField, ifValue, thenField,
        // thenNotEmpty:false}. Both validate against the field catalog and
        // normalize to the engine dialect.
        const keySig = Object.keys(paramsObj).sort().join(',');
        let condPair: { field: string; operator: string; value?: unknown }[];
        if (keySig === 'conditions') {
          const conditions = paramsObj.conditions;
          if (!Array.isArray(conditions)) {
            fail(`rule_cross_field_conflict_conditions_must_be_array:${idStr}`);
          }
          if (conditions.length < 2 || conditions.length > 5) {
            fail(`rule_cross_field_conflict_conditions_length_out_of_bounds:${idStr}`);
          }
          for (const cond of conditions) {
            validateCondition(cond, fieldById);
          }
          const conds = conditions as { field: string; operator: string; value?: unknown }[];
          if (
            conds.length !== 2 ||
            conds[0].operator !== 'equals' ||
            conds[1].operator !== 'not_empty'
          ) {
            fail(`rule_cross_field_conflict_unsupported_pattern:${idStr}`);
          }
          condPair = conds;
        } else if (keySig === 'fields,ifField,ifValue,thenField,thenNotEmpty') {
          if (paramsObj.thenNotEmpty !== false) {
            fail(`rule_cross_field_conflict_thenNotEmpty_must_be_false:${idStr}`);
          }
          const fieldsArr = paramsObj.fields;
          const ifField = paramsObj.ifField;
          const thenField = paramsObj.thenField;
          if (
            !Array.isArray(fieldsArr) || fieldsArr.length !== 2 ||
            typeof ifField !== 'string' || typeof thenField !== 'string' ||
            fieldsArr[0] !== ifField || fieldsArr[1] !== thenField
          ) {
            fail(`rule_cross_field_conflict_fields_mismatch:${idStr}`);
          }
          condPair = [
            { field: ifField, operator: 'equals', value: paramsObj.ifValue },
            { field: thenField, operator: 'not_empty' },
          ];
          for (const cond of condPair) {
            validateCondition(cond, fieldById);
          }
        } else {
          fail(`rule_cross_field_conflict_params_must_only_have_conditions:${idStr}`);
        }
        engineParams = {
          fields: [condPair[0].field, condPair[1].field],
          ifField: condPair[0].field,
          ifValue: condPair[0].value,
          thenField: condPair[1].field,
          thenNotEmpty: false,
        };
        break;
      }

      case 'conditional_document': {
        const pKeys = Object.keys(paramsObj);
        if (pKeys.length !== 1 || (pKeys[0] !== 'condition' && pKeys[0] !== 'when')) {
          fail(`rule_conditional_document_params_must_only_have_condition:${idStr}`);
        }
        const cond = pKeys[0] === 'condition' ? paramsObj.condition : paramsObj.when;
        validateCondition(cond, fieldById);
        engineParams = { when: cond };
        break;
      }

      default:
        fail(`rule_unsupported_rule_type:${idStr}:${typeStr}`);
    }

    checkBoundedString(message, MAX_MESSAGE, 'rule_message', idStr);
    checkBoundedString(suggestion, MAX_MESSAGE, 'rule_suggestion', idStr);

    if (severity !== 'error' && severity !== 'warning') {
      fail(`rule_invalid_severity:${idStr}`);
    }
    const severityStr = severity as 'error' | 'warning';

    if (typeof orderNumber !== 'number' || !Number.isSafeInteger(orderNumber)) {
      fail(`rule_orderNumber_not_safe_integer:${idStr}`);
    }
    if (orderNumber < ORDER_MIN || orderNumber > ORDER_MAX) {
      fail(`rule_orderNumber_out_of_bounds:${idStr}`);
    }

    const ruleDef: RuleDef = {
      id: idStr,
      type: typeStr,
      params: engineParams,
      message: message as string,
      suggestion: suggestion as string,
      severity: severityStr,
      orderNumber: orderNumber as number,
    };
    if (fieldIdStr !== undefined) {
      ruleDef.fieldId = fieldIdStr;
    }

    rules.push(ruleDef);
  }

  return rules;
}

export function parseMigrationHints(raw: unknown): MigrationHint[] {
  assertConfigSize(raw);

  if (!Array.isArray(raw)) {
    fail('hints_not_array');
  }
  if (raw.length > MAX_HINTS) {
    fail('hints_length_out_of_bounds');
  }

  const hints: MigrationHint[] = [];
  const fromSet = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isPlainObject(item)) {
      fail(`hint_not_object:${i}`);
    }

    const keys = Object.keys(item);
    if (keys.length !== 2 || !keys.includes('from') || !keys.includes('candidates')) {
      fail(`hint_invalid_keys:${i}`);
    }

    const { from, candidates } = item as Record<string, unknown>;

    checkSlug(from, 'hint_from', String(i));
    const fromStr = from as string;
    if (fromSet.has(fromStr)) {
      fail(`hint_duplicate_from:${fromStr}`);
    }
    fromSet.add(fromStr);

    if (!Array.isArray(candidates)) {
      fail(`hint_candidates_not_array:${fromStr}`);
    }
    if (candidates.length > MAX_CANDIDATES) {
      fail(`hint_candidates_length_out_of_bounds:${fromStr}`);
    }

    const candidatesList: string[] = [];
    const candidatesSeen = new Set<string>();

    for (let j = 0; j < candidates.length; j++) {
      const candidate = candidates[j];
      checkSlug(candidate, 'hint_candidate', `${fromStr}:${j}`);
      const candStr = candidate as string;
      if (candidatesSeen.has(candStr)) {
        fail(`hint_candidate_duplicate:${fromStr}:${candStr}`);
      }
      candidatesSeen.add(candStr);
      candidatesList.push(candStr);
    }

    hints.push({
      from: fromStr,
      candidates: candidatesList,
    });
  }

  return hints;
}

/**
 * Guard for official public-service DISPLAY links only. NOT an SSRF egress boundary.
 * Any code that ever fetches these URLs server-side must pass a separate
 * network-layer egress guard (DNS resolution, IP-range blocking, redirect re-validation,
 * and connect-time validation), which is intentionally outside this module's scope.
 */
export function safeHttpsUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > MAX_URL) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return null;
  }
  if (parsed.port !== '' && parsed.port !== '443') {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname.startsWith('[')) {
    return null;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }
  if (hostname === 'localhost') {
    return null;
  }
  if (hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return null;
  }
  if (!hostname.includes('.')) {
    return null;
  }

  const approvedGovernmentHosts = ['dichvucong.gov.vn'] as const;
  const isApprovedGovernmentHost = approvedGovernmentHosts.some(
    (approved) => hostname === approved || hostname.endsWith(`.${approved}`)
  );
  if (!isApprovedGovernmentHost) {
    return null;
  }

  return parsed.href;
}
