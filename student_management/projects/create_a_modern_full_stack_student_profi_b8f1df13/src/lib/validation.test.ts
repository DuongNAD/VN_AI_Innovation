/**
 * Unit tests for the shared student validation logic.
 *
 * These tests run under Vitest's default `node` environment and lock every
 * rule in `validation.ts` by asserting the EXACT return values and messages
 * each validator produces. Because the same module is consumed by both the
 * client form and the API routes, pinning the messages here prevents the two
 * surfaces from ever drifting apart.
 */
import { describe, it, expect } from 'vitest';
import {
  validateStudentId,
  validateFullName,
  validateEmail,
  validateMajor,
  parseGpa,
  validateGpa,
  validateStudent,
  type StudentInput,
} from './validation';

// Stable message constants mirrored from validation.ts. Declaring them here
// (rather than importing) means a change to a message in the source must be
// deliberately reflected in the test, which is the point of "locking".
const STUDENT_ID_REQUIRED = 'Student ID is required';
const STUDENT_ID_LENGTH = 'Student ID must be 32 characters or fewer';
const FULL_NAME_REQUIRED = 'Full name is required';
const FULL_NAME_LENGTH = 'Full name must be 100 characters or fewer';
const EMAIL_REQUIRED = 'Email is required';
const EMAIL_INVALID = 'Enter a valid email address';
const MAJOR_REQUIRED = 'Major is required';
const MAJOR_LENGTH = 'Major must be 80 characters or fewer';
const GPA_REQUIRED = 'GPA is required';
const GPA_RANGE = 'GPA must be between 0.0 and 4.0';
const GPA_INVALID = 'GPA must be a plain decimal number (e.g. 3.75)';

describe('validateStudentId', () => {
  it('returns null for a valid id', () => {
    expect(validateStudentId('S1001')).toBeNull();
  });

  it('returns the required message for empty or whitespace-only input', () => {
    expect(validateStudentId('')).toBe(STUDENT_ID_REQUIRED);
    expect(validateStudentId('   ')).toBe(STUDENT_ID_REQUIRED);
  });

  it('returns the length message for a 33-character id', () => {
    expect(validateStudentId('a'.repeat(33))).toBe(STUDENT_ID_LENGTH);
  });

  it('accepts a 32-character id (boundary)', () => {
    expect(validateStudentId('a'.repeat(32))).toBeNull();
  });
});

describe('validateFullName', () => {
  it('returns null for a valid name', () => {
    expect(validateFullName('Ada Lovelace')).toBeNull();
  });

  it('returns the required message for empty input', () => {
    expect(validateFullName('')).toBe(FULL_NAME_REQUIRED);
  });

  it('returns the length message for a 101-character name', () => {
    expect(validateFullName('a'.repeat(101))).toBe(FULL_NAME_LENGTH);
  });

  it('accepts a 100-character name (boundary)', () => {
    expect(validateFullName('a'.repeat(100))).toBeNull();
  });
});

describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('a@b.co')).toBeNull();
  });

  it('returns the required message for empty input', () => {
    expect(validateEmail('')).toBe(EMAIL_REQUIRED);
  });

  it('returns the invalid message for malformed addresses', () => {
    expect(validateEmail('nope')).toBe(EMAIL_INVALID);
    expect(validateEmail('a@b')).toBe(EMAIL_INVALID);
    expect(validateEmail('a b@c.com')).toBe(EMAIL_INVALID);
    expect(validateEmail('a@@b.com')).toBe(EMAIL_INVALID);
  });
});

describe('validateMajor', () => {
  it('returns null for a valid major', () => {
    expect(validateMajor('Physics')).toBeNull();
  });

  it('returns the required message for empty input', () => {
    expect(validateMajor('')).toBe(MAJOR_REQUIRED);
  });

  it('returns the length message for an 81-character major', () => {
    expect(validateMajor('a'.repeat(81))).toBe(MAJOR_LENGTH);
  });

  it('accepts an 80-character major (boundary)', () => {
    expect(validateMajor('a'.repeat(80))).toBeNull();
  });
});

describe('parseGpa (number branch)', () => {
  it('returns finite numbers unchanged', () => {
    expect(parseGpa(3.5)).toBe(3.5);
    expect(parseGpa(0)).toBe(0);
  });

  it('rejects non-finite numbers', () => {
    expect(parseGpa(NaN)).toBeNull();
    expect(parseGpa(Infinity)).toBeNull();
    expect(parseGpa(-Infinity)).toBeNull();
  });
});

describe('parseGpa (string branch)', () => {
  it('parses plain decimal numerals', () => {
    expect(parseGpa('3.75')).toBe(3.75);
    expect(parseGpa('0')).toBe(0);
  });

  it('returns null for empty or whitespace-only strings', () => {
    expect(parseGpa('')).toBeNull();
    expect(parseGpa('   ')).toBeNull();
  });

  it('rejects strings that are not plain decimal numerals', () => {
    expect(parseGpa('abc')).toBeNull();
    expect(parseGpa('0x3')).toBeNull();
    expect(parseGpa('0b11')).toBeNull();
    expect(parseGpa('1e0')).toBeNull();
  });
});

describe('validateGpa', () => {
  it('accepts both boundaries and an in-range value', () => {
    expect(validateGpa('0')).toBeNull();
    expect(validateGpa('4')).toBeNull();
    expect(validateGpa('2.7')).toBeNull();
  });

  it('returns the required message for empty or whitespace-only input', () => {
    expect(validateGpa('')).toBe(GPA_REQUIRED);
    expect(validateGpa('   ')).toBe(GPA_REQUIRED);
  });

  it('returns the range message for out-of-range values', () => {
    expect(validateGpa('-0.1')).toBe(GPA_RANGE);
    expect(validateGpa('4.1')).toBe(GPA_RANGE);
  });

  it('returns the invalid message (distinct from required) for non-decimal input', () => {
    for (const value of ['x', '0x3', '1e0']) {
      expect(validateGpa(value)).toBe(GPA_INVALID);
      // Guard the key contract: a user who typed something is NOT told the
      // field is empty.
      expect(validateGpa(value)).not.toBe(GPA_REQUIRED);
    }
  });
});

describe('validateStudent', () => {
  it('returns an empty map for a fully valid input', () => {
    const input: StudentInput = {
      studentId: 'S1001',
      fullName: 'Ada Lovelace',
      email: 'ada@example.edu',
      major: 'Computer Science',
      gpa: '3.9',
    };
    expect(validateStudent(input)).toEqual({});
  });

  it('collects exactly the invalid fields with matching messages and omits valid ones', () => {
    const input: StudentInput = {
      studentId: '',
      fullName: 'Ada Lovelace',
      email: 'nope',
      major: 'Physics',
      gpa: '5',
    };
    expect(validateStudent(input)).toEqual({
      studentId: STUDENT_ID_REQUIRED,
      email: EMAIL_INVALID,
      gpa: GPA_RANGE,
    });
  });
});