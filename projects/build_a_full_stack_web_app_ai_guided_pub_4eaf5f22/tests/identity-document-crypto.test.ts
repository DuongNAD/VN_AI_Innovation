import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptIdentityImage,
  encryptIdentityImage,
} from '@/lib/identity-document-crypto';

const originalKey = process.env.IDENTITY_DOCUMENT_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.IDENTITY_DOCUMENT_KEY;
  else process.env.IDENTITY_DOCUMENT_KEY = originalKey;
});

describe('identity document encryption', () => {
  it('round-trips image bytes with authenticated encryption', () => {
    process.env.IDENTITY_DOCUMENT_KEY = 'test-only-secret-with-at-least-32-characters';
    const plain = Buffer.from('private citizen identity image');
    const encrypted = encryptIdentityImage(plain);

    expect(encrypted.ciphertext).not.toEqual(plain);
    expect(decryptIdentityImage(encrypted)).toEqual(plain);
  });

  it('requires a sufficiently long secret', () => {
    process.env.IDENTITY_DOCUMENT_KEY = 'short';
    expect(() => encryptIdentityImage(Buffer.from('image'))).toThrow('IDENTITY_DOCUMENT_KEY');
  });
});
