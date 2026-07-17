import { describe, it, expect } from 'vitest';
import { syncVisibility, visibleFieldsFor } from '@/components/DynamicForm';
import { runRules } from '@/lib/rule-engine';
import { parseFieldDefs, parseRuleDefs, type FieldDef } from '@/lib/schema-guards';

// Mirrors the seeded marriage form: marriage_number is only visible while
// previously_married is true, and the cross-field conflict rule must still see
// its value after the user flips back to "Chưa" (docs/DEMO_SCRIPT.md step 3).
const fields: FieldDef[] = [
  { id: 'previously_married', type: 'radio', label: 'Đã từng kết hôn chưa', required: true },
  {
    id: 'marriage_number',
    type: 'number',
    label: 'Số lần kết hôn',
    visibleWhen: { field: 'previously_married', operator: 'equals', value: true },
  },
];

describe('DynamicForm · visibility sync', () => {
  it('keeps the value of a field that becomes hidden', () => {
    let data: Record<string, unknown> = syncVisibility(fields, {});
    data = syncVisibility(fields, { ...data, previously_married: true });
    data = syncVisibility(fields, { ...data, marriage_number: 2 });
    data = syncVisibility(fields, { ...data, previously_married: false });

    expect(data.marriage_number).toBe(2);
    expect(data.previously_married).toBe(false);
  });

  it('renders only visible fields while hidden values stay in state', () => {
    const data = { previously_married: false, marriage_number: 2 };
    const visible = visibleFieldsFor(fields, data).map((f) => f.id);
    expect(visible).toEqual(['previously_married']);
  });

  it('restores the previous value when the field becomes visible again', () => {
    let data: Record<string, unknown> = { previously_married: false, marriage_number: 2 };
    data = syncVisibility(fields, { ...data, previously_married: true });
    expect(data.marriage_number).toBe(2);
    expect(visibleFieldsFor(fields, data).map((f) => f.id)).toEqual([
      'previously_married',
      'marriage_number',
    ]);
  });

  it('seeds visible fields with empty strings so required rules fire', () => {
    const data = syncVisibility(fields, {});
    expect(data).toEqual({ previously_married: '' });
  });

  it('canonical demo sequence still produces the contradiction error', () => {
    // Same authoring shapes as prisma/seed.ts, round-tripped through the
    // schema guards exactly like production reads them from the database.
    const parsedFields = parseFieldDefs([
      {
        id: 'previously_married',
        type: 'radio',
        label: 'Đã từng kết hôn chưa',
        required: true,
        options: [
          { value: true, label: 'Có' },
          { value: false, label: 'Chưa' },
        ],
      },
      {
        id: 'marriage_number',
        type: 'number',
        label: 'Số lần kết hôn',
        required: false,
        visibleWhen: { field: 'previously_married', operator: 'equals', value: true },
      },
    ]);
    const parsedRules = parseRuleDefs([
      {
        id: 'mr_v1_conflict_marriage',
        type: 'cross_field_conflict',
        params: {
          conditions: [
            { field: 'previously_married', operator: 'equals', value: false },
            { field: 'marriage_number', operator: 'not_empty' },
          ],
        },
        message: 'Thông tin mâu thuẫn: chưa từng kết hôn nhưng có số lần kết hôn',
        suggestion: 'Kiểm tra lại lựa chọn Đã từng kết hôn chưa hoặc Số lần kết hôn',
        severity: 'error',
        orderNumber: 15,
      },
    ], parsedFields);

    // Có → nhập 2 → đổi lại Chưa (exact demo-script interaction)
    let data: Record<string, unknown> = syncVisibility(parsedFields, {});
    data = syncVisibility(parsedFields, { ...data, previously_married: true });
    data = syncVisibility(parsedFields, { ...data, marriage_number: 2 });
    data = syncVisibility(parsedFields, { ...data, previously_married: false });

    const errors = runRules(parsedFields, parsedRules, data);
    expect(errors.map((e) => e.code)).toEqual(['CONFLICT']);
  });
});
