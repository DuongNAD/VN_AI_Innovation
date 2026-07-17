import { DISCLAIMER, PROVINCES, LIMITS } from './constants';
import { AppError } from './errors';
import { evaluateCondition } from './rule-engine';

export type ConditionDef = {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'greater_than' | 'less_than' | 'is_empty' | 'not_empty';
  value?: unknown;
};

export type QuestionRow = {
  code: string;
  orderNumber: number;
  fieldType: 'radio' | 'select' | 'text' | 'province';
  options: { value: string | boolean; label: string }[] | null;
  condition: ConditionDef | null;
  questionText: string;
};

export type DocumentRow = {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  orderNumber: number;
  condition?: unknown | null;
  conditionJson?: unknown | null;
  reasonText?: string | null;
  reason?: string | null;
};

export type GuidanceDocument = {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  reason: string | null;
};

export type Guidance = {
  procedure: {
    code: string;
    name: string;
    agency: string;
    sourceUrl: string;
    version: string;
    lastCheckedAt: string | Date;
    legalBasisText: string | null;
  };
  checklist: GuidanceDocument[];
  steps: any[];
  durationText: string;
  feesText: string;
  disclaimer: string;
  formAvailable: boolean;
};

const SOURCE_URL_MAX_LENGTH = 2048;
const STEPS_JSON_MAX_CHARS = 100000;
const STEPS_MAX_COUNT = 100;
const STEP_TEXT_MAX_CHARS = 2000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return false;
  }
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function assertHttpsSourceUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError(500, 'DATA_INTEGRITY', 'Đường dẫn nguồn không hợp lệ.', { field: 'sourceUrl', reason: 'not_string' });
  }
  if (value.length > SOURCE_URL_MAX_LENGTH) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Đường dẫn nguồn quá dài.', { field: 'sourceUrl', reason: 'too_long' });
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (err) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Đường dẫn nguồn không thể phân tích.', { field: 'sourceUrl', reason: 'unparseable' });
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError(500, 'DATA_INTEGRITY', 'Đường dẫn nguồn phải sử dụng giao thức HTTPS.', { field: 'sourceUrl', reason: 'protocol' });
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new AppError(500, 'DATA_INTEGRITY', 'Đường dẫn nguồn không được chứa thông tin đăng nhập.', { field: 'sourceUrl', reason: 'userinfo' });
  }
  return value;
}

function assertConditionDef(
  value: unknown,
  allowedFields: ReadonlySet<string>,
  context: string
): asserts value is ConditionDef {
  if (!isPlainObject(value)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Điều kiện không phải là đối tượng hợp lệ.', { field: 'condition', reason: 'not_object' });
  }

  const keys = Object.keys(value);
  for (const k of keys) {
    if (k !== 'field' && k !== 'operator' && k !== 'value') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Điều kiện chứa khóa không hợp lệ.', { field: 'condition', reason: 'extra_key' });
    }
  }

  if (!keys.includes('field') || !keys.includes('operator')) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Điều kiện thiếu khóa bắt buộc.', { field: 'condition', reason: 'missing_key' });
  }

  const fieldVal = value.field;
  const operatorVal = value.operator;
  const condVal = value.value;

  if (typeof fieldVal !== 'string' || fieldVal === '') {
    throw new AppError(500, 'DATA_INTEGRITY', 'Trường điều kiện không hợp lệ.', { field: 'condition', reason: 'invalid_field' });
  }

  if (!allowedFields.has(fieldVal)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Trường điều kiện không nằm trong danh sách câu hỏi.', { field: 'condition', reason: 'field_not_allowed' });
  }

  const operators = ['equals', 'not_equals', 'in', 'greater_than', 'less_than', 'is_empty', 'not_empty'];
  if (typeof operatorVal !== 'string' || !operators.includes(operatorVal)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Toán tử điều kiện không hợp lệ.', { field: 'condition', reason: 'invalid_operator' });
  }

  if (operatorVal === 'is_empty' || operatorVal === 'not_empty') {
    if (condVal !== undefined) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Điều kiện kiểm tra trống không được chứa giá trị.', { field: 'condition', reason: 'invalid_value' });
    }
  } else if (operatorVal === 'in') {
    if (!Array.isArray(condVal)) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Giá trị điều kiện in phải là một mảng.', { field: 'condition', reason: 'invalid_value' });
    }
    for (const item of condVal) {
      const type = typeof item;
      if (type !== 'string' && type !== 'number' && type !== 'boolean') {
        throw new AppError(500, 'DATA_INTEGRITY', 'Mỗi phần tử trong danh sách giá trị điều kiện phải là kiểu nguyên thủy.', { field: 'condition', reason: 'invalid_value' });
      }
    }
  } else {
    const type = typeof condVal;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Giá trị điều kiện phải là kiểu nguyên thủy.', { field: 'condition', reason: 'invalid_value' });
    }
  }
}

function parseSteps(value: unknown): { order: number; title: string; description: string; example: string }[] {
  if (typeof value !== 'string') {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu các bước không phải là chuỗi.', { field: 'steps', reason: 'not_string' });
  }
  if (value.length > STEPS_JSON_MAX_CHARS) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu các bước quá dài.', { field: 'steps', reason: 'too_long' });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Không thể phân tích dữ liệu các bước.', { field: 'steps', reason: 'unparseable' });
  }
  if (!Array.isArray(parsed)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu các bước phải là danh sách.', { field: 'steps', reason: 'not_array' });
  }
  if (parsed.length > STEPS_MAX_COUNT) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Danh sách các bước vượt quá giới hạn.', { field: 'steps', reason: 'too_many_steps' });
  }
  for (let i = 0; i < parsed.length; i++) {
    const step = parsed[i];
    if (!isPlainObject(step)) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu bước không hợp lệ.', { field: 'steps', reason: 'invalid_step_shape' });
    }
    const { order, title, description, example } = step;
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Số thứ tự bước không hợp lệ.', { field: 'steps', reason: 'invalid_order' });
    }
    if (typeof title !== 'string') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Tiêu đề bước không hợp lệ.', { field: 'steps', reason: 'invalid_title' });
    }
    if (title.length > STEP_TEXT_MAX_CHARS) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Tiêu đề bước quá dài.', { field: 'steps', reason: 'title_too_long' });
    }
    if (typeof description !== 'string') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Mô tả bước không hợp lệ.', { field: 'steps', reason: 'invalid_description' });
    }
    if (description.length > STEP_TEXT_MAX_CHARS) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Mô tả bước quá dài.', { field: 'steps', reason: 'description_too_long' });
    }
    if (typeof example !== 'string') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Ví dụ bước không hợp lệ.', { field: 'steps', reason: 'invalid_example' });
    }
    if (example.length > STEP_TEXT_MAX_CHARS) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Ví dụ bước quá dài.', { field: 'steps', reason: 'example_too_long' });
    }
  }
  return parsed as { order: number; title: string; description: string; example: string }[];
}

export function computeQuestionFlow(
  questions: QuestionRow[],
  answers: Record<string, unknown>
): { next: QuestionRow | null; answered: number; total: number } {
  const allowedFields = new Set(questions.map((q) => q.code));
  for (const q of questions) {
    if (q.condition !== null && q.condition !== undefined) {
      assertConditionDef(q.condition, allowedFields, q.code);
    }
  }

  const sorted = [...questions].sort((a, b) => a.orderNumber - b.orderNumber);
  let total = 0;
  let answered = 0;
  let next: QuestionRow | null = null;

  for (const q of sorted) {
    const isApplicable = !q.condition || evaluateCondition(q.condition, answers);
    if (isApplicable) {
      total++;
      if (answers[q.code] !== undefined) {
        answered++;
      } else if (!next) {
        next = q;
      }
    }
  }

  return { next, answered, total };
}

export function pruneAnswers(
  questions: QuestionRow[],
  answers: Record<string, unknown>
): { answers: Record<string, unknown>; removed: string[] } {
  const allowedFields = new Set(questions.map((q) => q.code));
  for (const q of questions) {
    if (q.condition !== null && q.condition !== undefined) {
      assertConditionDef(q.condition, allowedFields, q.code);
    }
  }

  const currentAnswers = { ...answers };
  const questionCodes = new Set(questions.map((q) => q.code));
  const removedSet = new Set<string>();

  // Drop keys with no matching question
  for (const key of Object.keys(currentAnswers)) {
    if (!questionCodes.has(key)) {
      delete currentAnswers[key];
      removedSet.add(key);
    }
  }

  // Iterate to FIXPOINT
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of questions) {
      if (currentAnswers[q.code] !== undefined) {
        const isApplicable = !q.condition || evaluateCondition(q.condition, currentAnswers);
        if (!isApplicable) {
          delete currentAnswers[q.code];
          removedSet.add(q.code);
          changed = true;
        }
      }
    }
  }

  return {
    answers: currentAnswers,
    removed: Array.from(removedSet),
  };
}

export function validateAnswer(q: QuestionRow, value: unknown): unknown {
  if (q.fieldType === 'radio' || q.fieldType === 'select') {
    const hasBooleanOption = q.options?.some((opt) => typeof opt.value === 'boolean') ?? false;
    let coercedValue = value;
    if (hasBooleanOption) {
      if (value === 'true') {
        coercedValue = true;
      } else if (value === 'false') {
        coercedValue = false;
      }
    }
    const isValid = q.options?.some((opt) => opt.value === coercedValue) ?? false;
    if (!isValid) {
      throw new AppError(400, 'INVALID_ANSWER', 'Câu trả lời không hợp lệ.', { questionCode: q.code });
    }
    return coercedValue;
  }

  if (q.fieldType === 'text') {
    if (typeof value !== 'string') {
      throw new AppError(400, 'INVALID_ANSWER', 'Câu trả lời không hợp lệ.', { questionCode: q.code });
    }
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.length > LIMITS.ANSWER_TEXT_MAX) {
      throw new AppError(400, 'INVALID_ANSWER', 'Câu trả lời không hợp lệ.', { questionCode: q.code });
    }
    return trimmed;
  }

  if (q.fieldType === 'province') {
    if (typeof value !== 'string' || !PROVINCES.includes(value)) {
      throw new AppError(400, 'INVALID_ANSWER', 'Câu trả lời không hợp lệ.', { questionCode: q.code });
    }
    return value;
  }

  throw new AppError(400, 'INVALID_ANSWER', 'Loại câu hỏi không hợp lệ.', { questionCode: q.code });
}

export function buildGuidance(input: {
  procedure: {
    code: string;
    name: string;
    agency: string;
    sourceUrl: string;
    lastCheckedAt: string | Date;
    legalBasisText?: string | null;
  };
  procedureVersion: {
    version: string;
    stepsJson: unknown;
    durationText: string;
    feesText: string;
    legalBasisText?: string | null;
  };
  documents: DocumentRow[];
  answers: Record<string, unknown>;
  questions?: QuestionRow[];
  formAvailable?: boolean;
}): Guidance {
  const { procedure, procedureVersion, documents, answers } = input;

  // Run all guards before assembling any output
  const validatedSourceUrl = assertHttpsSourceUrl(procedure.sourceUrl);
  const validatedSteps = parseSteps(procedureVersion.stepsJson);

  const allowedFields = new Set<string>(
    input.questions
      ? input.questions.map((q) => q.code)
      : Object.keys(answers)
  );

  for (const doc of documents) {
    const cond = doc.condition !== undefined && doc.condition !== null
      ? doc.condition
      : (doc.conditionJson !== undefined && doc.conditionJson !== null ? doc.conditionJson : null);
    if (cond !== null) {
      assertConditionDef(cond, allowedFields, doc.code);
    }
  }

  const checklist: GuidanceDocument[] = [];
  const sortedDocs = [...documents].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0));

  for (const doc of sortedDocs) {
    const cond = doc.condition !== undefined && doc.condition !== null
      ? doc.condition
      : (doc.conditionJson !== undefined && doc.conditionJson !== null ? doc.conditionJson : null);
    const isConditional = cond !== null;
    const isIncluded = !isConditional || evaluateCondition(cond as ConditionDef, answers);

    if (isIncluded) {
      checklist.push({
        code: doc.code,
        name: doc.name,
        originals: doc.originals,
        copies: doc.copies,
        submissionType: doc.submissionType,
        reason: isConditional ? (doc.reasonText || doc.reason || null) : null,
      });
    }
  }

  const sortedSteps = [...validatedSteps].sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    procedure: {
      code: procedure.code,
      name: procedure.name,
      agency: procedure.agency,
      sourceUrl: validatedSourceUrl,
      version: procedureVersion.version,
      lastCheckedAt: procedure.lastCheckedAt,
      legalBasisText: procedure.legalBasisText || procedureVersion.legalBasisText || null,
    },
    checklist,
    steps: sortedSteps,
    durationText: procedureVersion.durationText,
    feesText: procedureVersion.feesText,
    disclaimer: DISCLAIMER,
    formAvailable: !!input.formAvailable,
  };
}