import { describe, it, expect } from 'vitest';
import { decideSignatureCheck, extractSignerNames } from '@/lib/ai/document-check';

const AT = '2026-01-01T00:00:00.000Z';
const decide = (raw: unknown) => decideSignatureCheck(raw, 'test-vision', AT);

describe('decideSignatureCheck', () => {
  it('passes a confident, signed, legible declaration', () => {
    const r = decide({ is_declaration: true, has_signature: true, is_legible: true, confidence: 0.9, reason: 'ok' });
    expect(r.status).toBe('PASSED');
    expect(r.hasSignature).toBe(true);
    expect(r.model).toBe('test-vision');
    expect(r.checkedAt).toBe(AT);
  });

  it('rejects a confident "not a declaration"', () => {
    const r = decide({ is_declaration: false, has_signature: false, is_legible: true, confidence: 0.9, reason: 'ảnh selfie' });
    expect(r.status).toBe('REJECTED');
    expect(r.reason).toBe('ảnh selfie');
  });

  it('rejects a confident missing-signature on a real declaration', () => {
    const r = decide({ is_declaration: true, has_signature: false, is_legible: true, confidence: 0.85, reason: '' });
    expect(r.status).toBe('REJECTED');
    // Empty reason falls back to a helpful default, never an empty string.
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('does NOT reject a negative made with low confidence — prefers review', () => {
    const r = decide({ is_declaration: false, has_signature: true, is_legible: true, confidence: 0.4, reason: 'không chắc' });
    expect(r.status).not.toBe('REJECTED');
    expect(r.status).toBe('REVIEW');
  });

  it('flags illegible images for manual review rather than rejecting', () => {
    const r = decide({ is_declaration: true, has_signature: true, is_legible: false, confidence: 0.9, reason: 'mờ' });
    expect(r.status).toBe('REVIEW');
  });

  it('routes uncertain/malformed output to REVIEW, not PASSED or REJECTED', () => {
    expect(decide({}).status).toBe('REVIEW');
    expect(decide(null).status).toBe('REVIEW');
    expect(decide('garbage').status).toBe('REVIEW');
    expect(decide({ is_declaration: true }).status).toBe('REVIEW');
  });

  it('clamps confidence into 0..1', () => {
    expect(decide({ confidence: 5 }).confidence).toBe(1);
    expect(decide({ confidence: -3 }).confidence).toBe(0);
    expect(decide({ confidence: 'x' as unknown as number }).confidence).toBe(0);
  });

  it('flags a name mismatch as REVIEW (never REJECTED) and keeps the names read', () => {
    const r = decide({
      is_declaration: true,
      has_signature: true,
      is_legible: true,
      name_match: false,
      names_seen: ['Nguyễn Văn B'],
      confidence: 0.9,
      reason: '',
    });
    expect(r.status).toBe('REVIEW');
    expect(r.nameMatch).toBe(false);
    expect(r.namesSeen).toEqual(['Nguyễn Văn B']);
  });

  it('passes with a confirmed name match and null-safe when names are absent', () => {
    const matched = decide({ is_declaration: true, has_signature: true, is_legible: true, name_match: true, confidence: 0.9 });
    expect(matched.status).toBe('PASSED');
    expect(matched.nameMatch).toBe(true);

    const noNames = decide({ is_declaration: true, has_signature: true, is_legible: true, name_match: null, confidence: 0.9 });
    expect(noNames.status).toBe('PASSED');
    expect(noNames.nameMatch).toBeNull();
  });

  it('bounds and sanitizes names_seen from the model', () => {
    const r = decide({
      is_declaration: true,
      has_signature: true,
      name_match: false,
      confidence: 0.9,
      names_seen: ['  A  B ', 'A B', 42, 'C', 'D', 'E', 'F'],
    });
    expect(r.namesSeen).toEqual(['A B', 'C', 'D', 'E']);
  });
});

describe('extractSignerNames', () => {
  const fields = [
    { id: 'male_full_name', type: 'text' as const, label: 'Họ, chữ đệm, tên (nam)' },
    { id: 'female_full_name', type: 'text' as const, label: 'Họ, chữ đệm, tên (nữ)' },
    { id: 'residence', type: 'text' as const, label: 'Nơi cư trú' },
    { id: 'ho_ten', type: 'text' as const, label: 'Thông tin' },
    { id: 'attachment', type: 'file' as const, label: 'Họ và tên (file)' },
  ];

  it('picks name fields by id or label, skipping non-name and non-text fields', () => {
    const names = extractSignerNames(fields, {
      male_full_name: ' Nguyễn Văn A ',
      female_full_name: 'Trần Thị B',
      residence: 'Hà Nội',
      ho_ten: 'Lê Văn C',
      attachment: 'x.pdf',
    });
    expect(names).toEqual(['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C']);
  });

  it('matches by label alone (diacritics-insensitive)', () => {
    const names = extractSignerNames(
      [{ id: 'declarant', type: 'text', label: 'Họ và tên người khai' }],
      { declarant: 'Phạm D' }
    );
    expect(names).toEqual(['Phạm D']);
  });

  it('dedupes, ignores empty/non-string values, and caps at 4 names', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}_full_name`,
      type: 'text' as const,
      label: `Người ${i}`,
    }));
    const data: Record<string, unknown> = {};
    many.forEach((f, i) => {
      data[f.id] = i === 0 ? '' : i === 1 ? 7 : `Người ${i}`;
    });
    const names = extractSignerNames(many, data);
    expect(names).toEqual(['Người 2', 'Người 3', 'Người 4', 'Người 5']);

    expect(
      extractSignerNames(
        [
          { id: 'a_full_name', type: 'text', label: 'A' },
          { id: 'b_full_name', type: 'text', label: 'B' },
        ],
        { a_full_name: 'Trùng Tên', b_full_name: 'Trùng Tên' }
      )
    ).toEqual(['Trùng Tên']);
  });
});
