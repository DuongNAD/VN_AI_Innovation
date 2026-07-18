import { describe, expect, it } from 'vitest';
import { hashPassword, isStrongEnoughPassword, verifyPassword } from '@/lib/password';

describe('password hashing', () => {
  it('round-trips a hashed password', async () => {
    const hash = await hashPassword('Str0ngPass');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Str0ngPass', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('Str0ngPass');
    expect(await verifyPassword('WrongPass1', hash)).toBe(false);
  });

  it('uses a random salt — same password hashes differently but both verify', async () => {
    const a = await hashPassword('Str0ngPass');
    const b = await hashPassword('Str0ngPass');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Str0ngPass', a)).toBe(true);
    expect(await verifyPassword('Str0ngPass', b)).toBe(true);
  });

  it('returns false for malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$onlyfiveparts')).toBe(false);
  });
});

describe('password strength', () => {
  it('accepts a password with letters and digits, length >= 8', () => {
    expect(isStrongEnoughPassword('abcd1234')).toBe(true);
  });

  it('rejects too-short passwords', () => {
    expect(isStrongEnoughPassword('ab12')).toBe(false);
  });

  it('rejects letters-only and digits-only passwords', () => {
    expect(isStrongEnoughPassword('abcdefgh')).toBe(false);
    expect(isStrongEnoughPassword('12345678')).toBe(false);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(isStrongEnoughPassword('a1'.repeat(65))).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isStrongEnoughPassword(undefined as unknown as string)).toBe(false);
  });
});
