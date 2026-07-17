import { describe, it, expect } from 'vitest';
import { computeMigration } from '@/lib/form-migration';
import type { FieldDef, MigrationHint } from '@/lib/schema-guards';

function field(id: string, type: FieldDef['type'] = 'text'): FieldDef {
  return { id, type, label: id };
}

// v1.0 -> v2.0: `residence` splits into permanent/temporary; full_name is stable.
const oldFields: FieldDef[] = [field('full_name'), field('residence')];
const newFields: FieldDef[] = [
  field('full_name'),
  field('permanent_address'),
  field('temporary_address'),
];
const hints: MigrationHint[] = [
  { from: 'residence', candidates: ['permanent_address', 'temporary_address'] },
];

describe('form-migration · computeMigration', () => {
  it('copies compatible same-id fields and flags ambiguous ones without guessing', () => {
    const data = { full_name: 'Nguyễn Văn A', residence: 'Thạch Thất, Hà Nội' };
    const result = computeMigration(oldFields, newFields, hints, data);

    // Stable field carried over verbatim.
    expect(result.migrated).toContain('full_name');
    expect(result.migratedData.full_name).toBe('Nguyễn Văn A');

    // Ambiguous field is NEVER auto-assigned — it is surfaced for confirmation.
    expect(result.needsConfirmation).toHaveLength(1);
    expect(result.needsConfirmation[0]).toMatchObject({
      from: 'residence',
      value: 'Thạch Thất, Hà Nội',
      options: ['permanent_address', 'temporary_address'],
    });
    // Nothing was written to either candidate before the user chose.
    expect(result.migratedData.permanent_address).toBeUndefined();
    expect(result.migratedData.temporary_address).toBeUndefined();
    expect(result.applied).toHaveLength(0);
  });

  it('applies a user-provided resolution to the chosen target', () => {
    const data = { full_name: 'Nguyễn Văn A', residence: 'Thạch Thất, Hà Nội' };
    const result = computeMigration(oldFields, newFields, hints, data, {
      residence: 'permanent_address',
    });

    expect(result.applied).toEqual([{ from: 'residence', to: 'permanent_address' }]);
    expect(result.migratedData.permanent_address).toBe('Thạch Thất, Hà Nội');
    expect(result.needsConfirmation).toHaveLength(0);
  });

  it('rejects a resolution that is not an offered option', () => {
    const data = { residence: 'Hà Nội' };
    expect(() =>
      computeMigration(oldFields, newFields, hints, data, { residence: 'full_name' }),
    ).toThrow();
  });

  it('drops an old field that has no compatible destination', () => {
    const data = { legacy_note: 'obsolete' };
    const result = computeMigration([field('legacy_note')], newFields, [], data);
    expect(result.dropped).toContain('legacy_note');
    expect(result.migrated).toHaveLength(0);
  });

  it('skips empty values entirely', () => {
    const data = { full_name: '', residence: '' };
    const result = computeMigration(oldFields, newFields, hints, data);
    expect(result.migrated).toHaveLength(0);
    expect(result.needsConfirmation).toHaveLength(0);
    expect(result.dropped).toHaveLength(0);
  });
});
