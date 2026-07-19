import { describe, it, expect } from 'vitest';
import { decideSignatureCheck } from '@/lib/ai/document-check';

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
});
