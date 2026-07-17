import { describe, it, expect } from 'vitest';
import { runRules } from '@/lib/rule-engine';
import type { FieldDef, RuleDef } from '@/lib/schema-guards';

function field(id: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef {
  return { id, type, label: id, ...extra };
}

function rule(id: string, type: RuleDef['type'], params: Record<string, unknown>, extra: Partial<RuleDef> = {}): RuleDef {
  return {
    id,
    type,
    params,
    message: `msg_${id}`,
    suggestion: `fix_${id}`,
    severity: 'error',
    orderNumber: 1,
    ...extra,
  };
}

const codes = (errs: { code: string }[]) => errs.map((e) => e.code).sort();

describe('rule-engine · runRules', () => {
  it('canonical demo case returns EXACTLY the 3 expected errors', () => {
    const fields: FieldDef[] = [
      field('female_birth_date', 'date', { required: true }),
      field('male_identity_number', 'text'),
      field('previously_married', 'radio', {
        options: [
          { value: true, label: 'Đã từng' },
          { value: false, label: 'Chưa từng' },
        ],
      }),
      field('marriage_number', 'number'),
    ];
    const rules: RuleDef[] = [
      rule('r_req', 'required', {}, { fieldId: 'female_birth_date' }),
      rule('r_fmt', 'regex', { pattern: '^[0-9]{12}$' }, { fieldId: 'male_identity_number' }),
      rule('r_conflict', 'cross_field_conflict', {
        fields: ['previously_married', 'marriage_number'],
        ifField: 'previously_married',
        ifValue: false,
        thenField: 'marriage_number',
        thenNotEmpty: false,
      }),
    ];
    const data = {
      female_birth_date: '',
      male_identity_number: '123',
      previously_married: false,
      marriage_number: 2,
    };

    const errors = runRules(fields, rules, data);

    expect(errors).toHaveLength(3);
    expect(codes(errors)).toEqual(['CONFLICT', 'INVALID_FORMAT', 'MISSING_REQUIRED']);

    const conflict = errors.find((e) => e.code === 'CONFLICT')!;
    expect(conflict.fields).toEqual(['previously_married', 'marriage_number']);
    const missing = errors.find((e) => e.code === 'MISSING_REQUIRED')!;
    expect(missing.field).toBe('female_birth_date');
    const fmt = errors.find((e) => e.code === 'INVALID_FORMAT')!;
    expect(fmt.field).toBe('male_identity_number');
    // Vietnamese message + a fix suggestion travel with every error.
    for (const e of errors) {
      expect(typeof e.message).toBe('string');
      expect(e.suggestion.length).toBeGreaterThan(0);
    }
  });

  it('fully valid data yields zero errors', () => {
    const fields: FieldDef[] = [
      field('female_birth_date', 'date', { required: true }),
      field('male_identity_number', 'text'),
      field('previously_married', 'radio'),
      field('marriage_number', 'number'),
    ];
    const rules: RuleDef[] = [
      rule('r_req', 'required', {}, { fieldId: 'female_birth_date' }),
      rule('r_fmt', 'regex', { pattern: '^[0-9]{12}$' }, { fieldId: 'male_identity_number' }),
      rule('r_conflict', 'cross_field_conflict', {
        fields: ['previously_married', 'marriage_number'],
        ifField: 'previously_married',
        ifValue: false,
        thenField: 'marriage_number',
        thenNotEmpty: false,
      }),
    ];
    const data = {
      female_birth_date: '1990-05-01',
      male_identity_number: '012345678912',
      previously_married: true,
      marriage_number: 2,
    };
    expect(runRules(fields, rules, data)).toHaveLength(0);
  });

  it('number_range flags OUT_OF_RANGE and passes in-range', () => {
    const fields = [field('age', 'number')];
    const rules = [rule('r', 'number_range', { min: 18, max: 120 }, { fieldId: 'age' })];
    expect(codes(runRules(fields, rules, { age: 10 }))).toEqual(['OUT_OF_RANGE']);
    expect(runRules(fields, rules, { age: 30 })).toHaveLength(0);
  });

  it('date_not_future flags DATE_IN_FUTURE', () => {
    const fields = [field('issued', 'date')];
    const rules = [rule('r', 'date_not_future', {}, { fieldId: 'issued' })];
    expect(codes(runRules(fields, rules, { issued: '2999-01-01' }))).toEqual(['DATE_IN_FUTURE']);
    expect(runRules(fields, rules, { issued: '2000-01-01' })).toHaveLength(0);
  });

  it('date_after flags DATE_ORDER_INVALID when end <= start', () => {
    const fields = [field('start', 'date'), field('end', 'date')];
    const rules = [rule('r', 'date_after', { startField: 'start', endField: 'end' }, { fieldId: 'end' })];
    expect(codes(runRules(fields, rules, { start: '2020-01-02', end: '2020-01-01' }))).toEqual([
      'DATE_ORDER_INVALID',
    ]);
    expect(runRules(fields, rules, { start: '2020-01-01', end: '2020-01-02' })).toHaveLength(0);
  });

  it('conditional_required fires only when the condition holds', () => {
    const fields = [
      field('previously_married', 'radio'),
      field('divorce_document', 'file'),
    ];
    const rules = [
      rule(
        'r',
        'conditional_required',
        { when: { field: 'previously_married', operator: 'equals', value: true } },
        { fieldId: 'divorce_document' },
      ),
    ];
    expect(codes(runRules(fields, rules, { previously_married: true }))).toEqual(['MISSING_REQUIRED']);
    expect(runRules(fields, rules, { previously_married: false })).toHaveLength(0);
  });

  it('conditional_document flags MISSING_DOCUMENT when required by condition', () => {
    const fields = [
      field('previously_married', 'radio'),
      field('divorce_document', 'file'),
    ];
    const rules = [
      rule(
        'r',
        'conditional_document',
        { when: { field: 'previously_married', operator: 'equals', value: true } },
        { fieldId: 'divorce_document' },
      ),
    ];
    expect(codes(runRules(fields, rules, { previously_married: true }))).toEqual(['MISSING_DOCUMENT']);
    expect(
      runRules(fields, rules, { previously_married: true, divorce_document: 'quyet-dinh.pdf' }),
    ).toHaveLength(0);
  });

  it('an unknown rule type degrades to a DATA_INTEGRITY error', () => {
    const fields = [field('x', 'text')];
    const rules = [rule('r', 'made_up_rule' as RuleDef['type'], {}, { fieldId: 'x' })];
    expect(codes(runRules(fields, rules, { x: 'hi' }))).toEqual(['DATA_INTEGRITY']);
  });
});

describe('rule-engine · date comparisons in conditions', () => {
  it('greater_than / less_than compare ISO dates chronologically', () => {
    const fields: FieldDef[] = [
      field('birth_date', 'date'),
      field('note', 'text', { required: true }),
    ];
    const rules: RuleDef[] = [
      rule('r_minor', 'conditional_required', {}, {
        fieldId: 'note',
        params: { when: { field: 'birth_date', operator: 'greater_than', value: '2008-07-18' } },
      }),
    ];

    // Born after the threshold → condition true → required note missing
    expect(
      codes(runRules(fields, rules, { birth_date: '2010-01-01', note: '' }))
    ).toEqual(['MISSING_REQUIRED']);
    // Born before the threshold → condition false → no error
    expect(runRules(fields, rules, { birth_date: '2000-01-01', note: '' })).toHaveLength(0);
  });

  it('less_than works symmetrically for ISO dates', () => {
    const fields: FieldDef[] = [
      field('expiry_date', 'date'),
      field('renewal_note', 'text', { required: true }),
    ];
    const rules: RuleDef[] = [
      rule('r_exp', 'conditional_required', {}, {
        fieldId: 'renewal_note',
        params: { when: { field: 'expiry_date', operator: 'less_than', value: '2026-01-01' } },
      }),
    ];

    expect(
      codes(runRules(fields, rules, { expiry_date: '2025-06-30', renewal_note: '' }))
    ).toEqual(['MISSING_REQUIRED']);
    expect(
      runRules(fields, rules, { expiry_date: '2026-06-30', renewal_note: '' })
    ).toHaveLength(0);
  });
});
