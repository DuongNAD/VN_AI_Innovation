import { AppError } from '../errors';
import { PROVINCES, LIMITS } from '../constants';
import type { QuestionRow } from './types';

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

