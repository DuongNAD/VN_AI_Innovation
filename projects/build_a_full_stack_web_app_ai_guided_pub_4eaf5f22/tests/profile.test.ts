import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { parseProfileUpdate } from '@/lib/profile';

const validProfile = {
  displayName: '  Nguyễn Văn An  ',
  email: ' AN@example.com ',
  phone: '0901 234 567',
  dateOfBirth: '1995-06-15',
  address: '  12 Nguyễn Huệ, TP.HCM  ',
};

describe('citizen profile validation', () => {
  it('normalizes editable profile information', () => {
    const profile = parseProfileUpdate(validProfile);
    expect(profile).toMatchObject({
      displayName: 'Nguyễn Văn An',
      email: 'an@example.com',
      phone: '0901234567',
      address: '12 Nguyễn Huệ, TP.HCM',
    });
    expect(profile.dateOfBirth?.toISOString()).toBe('1995-06-15T00:00:00.000Z');
  });

  it('allows optional profile information to be cleared', () => {
    const profile = parseProfileUpdate({
      ...validProfile,
      email: '',
      phone: '',
      dateOfBirth: '',
      address: '',
    });
    expect(profile.email).toBeNull();
    expect(profile.phone).toBeNull();
    expect(profile.dateOfBirth).toBeNull();
    expect(profile.address).toBeNull();
  });

  it.each([
    [{ ...validProfile, email: 'khong-hop-le' }, 'email'],
    [{ ...validProfile, phone: '123' }, 'phone'],
    [{ ...validProfile, dateOfBirth: '2035-01-01' }, 'dateOfBirth'],
  ])('rejects invalid profile values', (body, field) => {
    try {
      parseProfileUpdate(body);
      throw new Error('Expected profile validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).details).toMatchObject({ field });
    }
  });
});
