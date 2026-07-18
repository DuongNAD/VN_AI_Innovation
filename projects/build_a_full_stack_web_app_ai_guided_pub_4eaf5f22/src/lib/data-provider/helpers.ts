import { AppError } from '../errors';
import {
  FieldDef,
  RuleDef,
  MigrationHint,
  ConditionDef,
  parseFieldDefs,
  parseMigrationHints,
  parseRuleDefs,
  safeHttpsUrl,
} from '../schema-guards';
import type { FormVersionDto } from './types';

export function parseConditionDef(raw: any): ConditionDef | null {
  if (!raw) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Condition must be an object'
    });
  }
  const { field, operator, value } = raw;
  if (typeof field !== 'string' || !field) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Condition field must be a non-empty string'
    });
  }
  const validOperators = ['equals', 'not_equals', 'in', 'greater_than', 'less_than', 'is_empty', 'not_empty'];
  if (!validOperators.includes(operator)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: `Invalid condition operator: ${operator}`
    });
  }
  return { field, operator, value };
}

export function parseQuestionOptions(raw: any): { value: string | boolean; label: string }[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Options must be an array'
    });
  }
  return raw.map((opt: any, idx: number) => {
    if (typeof opt !== 'object' || opt === null) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option at index ${idx} must be an object`
      });
    }
    const { value, label } = opt;
    if (typeof value !== 'string' && typeof value !== 'boolean') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option value at index ${idx} must be a string or boolean`
      });
    }
    if (typeof label !== 'string' || !label) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option label at index ${idx} must be a non-empty string`
      });
    }
    return { value, label };
  });
}

export function parseSteps(raw: any): { order: number; title: string; description: string; example: string }[] {
  if (!Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Steps must be an array'
    });
  }
  return raw.map((step: any, idx: number) => {
    if (typeof step !== 'object' || step === null) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step at index ${idx} must be an object`
      });
    }
    const { order, title, description, example } = step;
    if (typeof order !== 'number') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step order at index ${idx} must be a number`
      });
    }
    if (typeof title !== 'string' || !title) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step title at index ${idx} must be a non-empty string`
      });
    }
    if (typeof description !== 'string' || !description) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step description at index ${idx} must be a non-empty string`
      });
    }
    if (typeof example !== 'string' || !example) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step example at index ${idx} must be a non-empty string`
      });
    }
    return { order, title, description, example };
  });
}

export function mapFormVersion(row: any): FormVersionDto {
  const schemaObj = (row.schemaJson && typeof row.schemaJson === 'object') ? (row.schemaJson as any) : {};
  return {
    id: row.id,
    formId: row.formId,
    formCode: row.form?.code ?? '',
    version: row.version,
    status: row.status,
    effectiveFrom: row.effectiveFrom ? new Date(row.effectiveFrom) : null,
    effectiveTo: row.effectiveTo ? new Date(row.effectiveTo) : null,
    fields: parseFieldDefs(schemaObj.fields),
    migrationHints: parseMigrationHints(schemaObj.migrationHints ?? []),
  };
}
