import { AppError } from '../errors';
import type { ConditionDef } from './types';

export const SOURCE_URL_MAX_LENGTH = 2048;
export const STEPS_JSON_MAX_CHARS = 100000;
export const STEPS_MAX_COUNT = 100;
export const STEP_TEXT_MAX_CHARS = 2000;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return false;
  }
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function assertHttpsSourceUrl(value: unknown): string {
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

export function assertConditionDef(
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

export function parseSteps(value: unknown): { order: number; title: string; description: string; example: string }[] {
  // Prisma Json columns (and the data-provider) deliver steps as an already-
  // parsed array; a raw JSON string is also accepted for robustness.
  let parsed: unknown;
  if (typeof value === 'string') {
    if (value.length > STEPS_JSON_MAX_CHARS) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu các bước quá dài.', { field: 'steps', reason: 'too_long' });
    }
    try {
      parsed = JSON.parse(value);
    } catch (err) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Không thể phân tích dữ liệu các bước.', { field: 'steps', reason: 'unparseable' });
    }
  } else {
    parsed = value;
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
