import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPE_CODES,
  getDocumentTypeMeta,
  inferDocumentType,
  isDocumentTypeCode,
  parseDocumentTypeInput,
} from '@/lib/document-types';

describe('document-types catalog', () => {
  it('exposes the required classification codes', () => {
    expect(DOCUMENT_TYPE_CODES).toContain('MARRIAGE_REGISTRATION');
    expect(DOCUMENT_TYPE_CODES).toContain('DIVORCE_APPLICATION');
    expect(DOCUMENT_TYPE_CODES).toContain('BIRTH_CERTIFICATE');
    expect(DOCUMENT_TYPE_CODES).toContain('DEATH_CERTIFICATE');
    expect(DOCUMENT_TYPE_CODES).toContain('TEMPORARY_RESIDENCE');
    expect(DOCUMENT_TYPE_CODES).toContain('MARITAL_STATUS_CONFIRMATION');
    expect(DOCUMENT_TYPE_CODES).toContain('DOCUMENT_AUTHENTICATION');
    expect(DOCUMENT_TYPE_CODES).toContain('OTHER');
  });

  it('infers types from procedure / form codes', () => {
    expect(inferDocumentType('MARRIAGE_REGISTRATION')).toBe('MARRIAGE_REGISTRATION');
    expect(inferDocumentType('DIVORCE_REGISTRATION')).toBe('DIVORCE_APPLICATION');
    expect(inferDocumentType('BIRTH_REGISTRATION')).toBe('BIRTH_CERTIFICATE');
    expect(inferDocumentType('DEATH_REGISTRATION')).toBe('DEATH_CERTIFICATE');
    expect(inferDocumentType('TEMPORARY_RESIDENCE_REG')).toBe('TEMPORARY_RESIDENCE');
    expect(inferDocumentType('SINGLE_STATUS_CERT')).toBe('MARITAL_STATUS_CONFIRMATION');
    expect(inferDocumentType('DOCUMENT_AUTHENTICATION')).toBe('DOCUMENT_AUTHENTICATION');
    expect(inferDocumentType('UNKNOWN_PROC')).toBe('OTHER');
  });

  it('validates and parses input', () => {
    expect(isDocumentTypeCode('MARRIAGE_REGISTRATION')).toBe(true);
    expect(isDocumentTypeCode('nope')).toBe(false);
    expect(parseDocumentTypeInput('birth_certificate')).toBe('BIRTH_CERTIFICATE');
    expect(parseDocumentTypeInput('bad')).toBeNull();
    expect(getDocumentTypeMeta('DIVORCE_APPLICATION').label).toMatch(/ly hôn/i);
  });
});
